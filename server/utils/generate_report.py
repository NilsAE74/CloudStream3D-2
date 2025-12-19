#!/usr/bin/env python3
"""
Point Cloud Analysis and PDF Report Generator

This script analyzes XYZ point cloud data and generates a comprehensive
one-page PDF report in English with:
- Statistical analysis (count, extent, mean, std dev)
- Z-value histogram
- 3D visualization with Z-based coloring
- Average nearest neighbor distance

The PDF is optimized to stay under 2 MB through image compression.
"""

import sys
import os
import json
import numpy as np
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for server environments
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
from scipy.spatial import cKDTree
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib import colors
import io
from datetime import datetime


def parse_xyz_file(filepath):
    """
    Parse XYZ point cloud file.
    
    Args:
        filepath: Path to the XYZ/TXT/CSV file
        
    Returns:
        numpy array of shape (N, 3) containing X, Y, Z coordinates
    """
    print(f"[Parser] Reading file: {os.path.basename(filepath)}")
    
    points = []
    with open(filepath, 'r') as f:
        for line in f:
            line = line.strip()
            # Skip empty lines and comments
            if not line or line.startswith('#'):
                continue
            
            # Split by whitespace or comma
            parts = line.replace(',', ' ').split()
            if len(parts) >= 3:
                try:
                    x, y, z = float(parts[0]), float(parts[1]), float(parts[2])
                    points.append([x, y, z])
                except ValueError:
                    # Skip lines that can't be parsed (headers, etc.)
                    continue
    
    if len(points) == 0:
        raise ValueError("No valid points found in file")
    
    points_array = np.array(points)
    print(f"[Parser] Loaded {len(points_array)} points")
    return points_array


def calculate_statistics(points):
    """
    Calculate comprehensive statistics for the point cloud.
    
    Args:
        points: numpy array of shape (N, 3)
        
    Returns:
        Dictionary containing all statistics
    """
    print("[Analysis] Calculating statistics...")
    
    stats = {
        'count': len(points),
        'x_min': np.min(points[:, 0]),
        'x_max': np.max(points[:, 0]),
        'y_min': np.min(points[:, 1]),
        'y_max': np.max(points[:, 1]),
        'z_min': np.min(points[:, 2]),
        'z_max': np.max(points[:, 2]),
        'x_extent': np.max(points[:, 0]) - np.min(points[:, 0]),
        'y_extent': np.max(points[:, 1]) - np.min(points[:, 1]),
        'z_extent': np.max(points[:, 2]) - np.min(points[:, 2]),
        'x_mean': np.mean(points[:, 0]),
        'y_mean': np.mean(points[:, 1]),
        'z_mean': np.mean(points[:, 2]),
        'x_std': np.std(points[:, 0]),
        'y_std': np.std(points[:, 1]),
        'z_std': np.std(points[:, 2]),
    }
    
    print(f"[Analysis] Total points: {stats['count']}")
    return stats


def calculate_nearest_neighbor_distance(points, sample_size=1000):
    """
    Calculate average nearest neighbor distance.
    For large datasets, uses sampling to improve performance.
    
    Args:
        points: numpy array of shape (N, 3)
        sample_size: Maximum number of points to use for calculation
        
    Returns:
        Average nearest neighbor distance
    """
    print("[Analysis] Calculating nearest neighbor distance...")
    
    # For large datasets, sample points to improve performance
    if len(points) > sample_size:
        indices = np.random.choice(len(points), sample_size, replace=False)
        sample_points = points[indices]
        print(f"[Analysis] Using {sample_size} sampled points for NN calculation")
    else:
        sample_points = points
    
    # Build KD-tree for efficient nearest neighbor search
    tree = cKDTree(sample_points)
    
    # Query for 2 nearest neighbors (1st is the point itself, 2nd is the nearest)
    distances, _ = tree.query(sample_points, k=2)
    
    # Take the distance to the second nearest (index 1), which is the actual nearest neighbor
    nearest_distances = distances[:, 1]
    
    avg_distance = np.mean(nearest_distances)
    print(f"[Analysis] Average nearest neighbor distance: {avg_distance:.4f}")
    
    return avg_distance


def create_z_histogram(points, dpi=150):
    """
    Create histogram of Z-values.
    
    Args:
        points: numpy array of shape (N, 3)
        dpi: Resolution for the figure (lower = smaller file size)
        
    Returns:
        Image buffer containing the histogram
    """
    print("[Visualization] Creating Z-histogram...")
    
    fig, ax = plt.subplots(figsize=(6, 3.5), dpi=dpi)
    
    # Create histogram with 20 bins
    z_values = points[:, 2]
    n, bins, patches = ax.hist(z_values, bins=20, color='steelblue', 
                                edgecolor='black', alpha=0.7)
    
    ax.set_xlabel('Z-value (meters)', fontsize=10)
    ax.set_ylabel('Frequency (count)', fontsize=10)
    ax.set_title('Z-value Distribution', fontsize=11, fontweight='bold')
    ax.grid(True, alpha=0.3, linestyle='--')
    ax.tick_params(labelsize=9)
    
    # Tight layout to minimize whitespace
    plt.tight_layout()
    
    # Save to buffer with optimization
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=dpi, bbox_inches='tight', 
                facecolor='white', edgecolor='none')
    buf.seek(0)
    plt.close(fig)
    
    print("[Visualization] Z-histogram created")
    return buf


def create_3d_visualization(points, dpi=150):
    """
    Create 3D visualization with Z-based coloring.
    
    Args:
        points: numpy array of shape (N, 3)
        dpi: Resolution for the figure (lower = smaller file size)
        
    Returns:
        Image buffer containing the 3D visualization
    """
    print("[Visualization] Creating 3D point cloud visualization...")
    
    # For large datasets, downsample for visualization
    if len(points) > 50000:
        indices = np.random.choice(len(points), 50000, replace=False)
        vis_points = points[indices]
        print(f"[Visualization] Downsampled to 50,000 points for visualization")
    else:
        vis_points = points
    
    fig = plt.figure(figsize=(6, 4.5), dpi=dpi)
    ax = fig.add_subplot(111, projection='3d')
    
    # Extract coordinates
    x, y, z = vis_points[:, 0], vis_points[:, 1], vis_points[:, 2]
    
    # Color based on Z values (height-based coloring)
    scatter = ax.scatter(x, y, z, c=z, cmap='viridis', 
                        s=1, alpha=0.6, edgecolors='none')
    
    # Add colorbar
    cbar = fig.colorbar(scatter, ax=ax, pad=0.1, shrink=0.8)
    cbar.set_label('Z-value (meters)', rotation=270, labelpad=15, fontsize=9)
    cbar.ax.tick_params(labelsize=8)
    
    # Labels and title
    ax.set_xlabel('X (meters)', fontsize=9, labelpad=8)
    ax.set_ylabel('Y (meters)', fontsize=9, labelpad=8)
    ax.set_zlabel('Z (meters)', fontsize=9, labelpad=8)
    ax.set_title('3D Point Cloud Visualization', fontsize=11, fontweight='bold', pad=10)
    
    # Adjust tick label size
    ax.tick_params(axis='both', which='major', labelsize=8)
    
    # Set viewing angle for better perspective
    ax.view_init(elev=20, azim=45)
    
    # Tight layout
    plt.tight_layout()
    
    # Save to buffer with optimization
    buf = io.BytesIO()
    plt.savefig(buf, format='png', dpi=dpi, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    buf.seek(0)
    plt.close(fig)
    
    print("[Visualization] 3D visualization created")
    return buf


def generate_pdf_report(points, stats, avg_nn_distance, histogram_buf, 
                        visualization_buf, output_path, original_filename):
    """
    Generate a one-page PDF report with all analyses.
    
    Args:
        points: numpy array of shape (N, 3)
        stats: Dictionary of statistics
        avg_nn_distance: Average nearest neighbor distance
        histogram_buf: Buffer containing histogram image
        visualization_buf: Buffer containing 3D visualization image
        output_path: Path where PDF will be saved
        original_filename: Original input filename for the title
    """
    print("[Report] Generating PDF report...")
    
    # Create PDF document
    doc = SimpleDocTemplate(
        output_path,
        pagesize=letter,
        topMargin=0.5*inch,
        bottomMargin=0.5*inch,
        leftMargin=0.6*inch,
        rightMargin=0.6*inch
    )
    
    # Container for PDF elements
    story = []
    
    # Styles
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=colors.HexColor('#1a1a1a'),
        spaceAfter=8,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    )
    
    heading_style = ParagraphStyle(
        'CustomHeading',
        parent=styles['Heading2'],
        fontSize=11,
        textColor=colors.HexColor('#2c3e50'),
        spaceAfter=6,
        spaceBefore=8,
        fontName='Helvetica-Bold'
    )
    
    body_style = ParagraphStyle(
        'CustomBody',
        parent=styles['Normal'],
        fontSize=9,
        textColor=colors.HexColor('#2c3e50'),
        spaceAfter=4,
        alignment=TA_LEFT
    )
    
    # Title
    title = Paragraph(f"Point Cloud Analysis Report", title_style)
    story.append(title)
    
    # Subtitle with filename and date
    subtitle_text = f"<i>File: {original_filename} | Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}</i>"
    subtitle = Paragraph(subtitle_text, body_style)
    story.append(subtitle)
    story.append(Spacer(1, 0.15*inch))
    
    # Brief description
    description = Paragraph(
        "This report provides comprehensive statistical analysis and visualization "
        "of the uploaded point cloud data, including spatial extent, distribution metrics, "
        "and 3D visualization with height-based coloring.",
        body_style
    )
    story.append(description)
    story.append(Spacer(1, 0.15*inch))
    
    # Statistics Section
    stats_heading = Paragraph("Statistical Summary", heading_style)
    story.append(stats_heading)
    
    # Create statistics table
    stats_data = [
        ['Metric', 'Value', 'Metric', 'Value'],
        ['Total Points', f"{stats['count']:,}", 'X Extent (m)', f"{stats['x_extent']:.3f}"],
        ['X Mean (m)', f"{stats['x_mean']:.3f}", 'Y Extent (m)', f"{stats['y_extent']:.3f}"],
        ['Y Mean (m)', f"{stats['y_mean']:.3f}", 'Z Extent (m)', f"{stats['z_extent']:.3f}"],
        ['Z Mean (m)', f"{stats['z_mean']:.3f}", 'X Std Dev (m)', f"{stats['x_std']:.3f}"],
        ['Y Std Dev (m)', f"{stats['y_std']:.3f}", 'Z Std Dev (m)', f"{stats['z_std']:.3f}"],
        ['Avg NN Distance (m)', f"{avg_nn_distance:.4f}", '', ''],
    ]
    
    stats_table = Table(stats_data, colWidths=[1.8*inch, 1.2*inch, 1.8*inch, 1.2*inch])
    stats_table.setStyle(TableStyle([
        # Header row
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#3498db')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 9),
        ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
        
        # Data cells
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#ecf0f1')),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.HexColor('#2c3e50')),
        ('FONTNAME', (0, 1), (0, -1), 'Helvetica-Bold'),  # Left column labels
        ('FONTNAME', (2, 1), (2, -1), 'Helvetica-Bold'),  # Third column labels
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('ALIGN', (1, 1), (1, -1), 'RIGHT'),  # Right-align values
        ('ALIGN', (3, 1), (3, -1), 'RIGHT'),  # Right-align values
        
        # Grid
        ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('TOPPADDING', (0, 0), (-1, -1), 4),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 4),
    ]))
    
    story.append(stats_table)
    story.append(Spacer(1, 0.15*inch))
    
    # Visualizations Section
    viz_heading = Paragraph("Visualizations", heading_style)
    story.append(viz_heading)
    
    # Create a table to place images side by side
    histogram_img = Image(histogram_buf, width=3.2*inch, height=1.9*inch)
    viz_3d_img = Image(visualization_buf, width=3.2*inch, height=2.4*inch)
    
    # Two-column layout for images
    img_table = Table(
        [[histogram_img, viz_3d_img]],
        colWidths=[3.4*inch, 3.4*inch]
    )
    img_table.setStyle(TableStyle([
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
    ]))
    
    story.append(img_table)
    
    # Build PDF
    doc.build(story)
    
    # Check file size
    file_size_mb = os.path.getsize(output_path) / (1024 * 1024)
    print(f"[Report] PDF generated successfully: {output_path}")
    print(f"[Report] File size: {file_size_mb:.2f} MB")
    
    if file_size_mb > 2.0:
        print(f"[Report] WARNING: File size exceeds 2 MB limit!")
    
    return output_path


def main():
    """Main execution function."""
    if len(sys.argv) < 3:
        print("Usage: python generate_report.py <input_file> <output_file>")
        sys.exit(1)
    
    input_file = sys.argv[1]
    output_file = sys.argv[2]
    
    print("\n" + "="*60)
    print("POINT CLOUD ANALYSIS AND REPORT GENERATION")
    print("="*60)
    
    try:
        # Parse input file
        points = parse_xyz_file(input_file)
        
        # Calculate statistics
        stats = calculate_statistics(points)
        
        # Calculate average nearest neighbor distance
        avg_nn_distance = calculate_nearest_neighbor_distance(points)
        
        # Create visualizations
        histogram_buf = create_z_histogram(points, dpi=120)
        visualization_buf = create_3d_visualization(points, dpi=120)
        
        # Generate PDF report
        original_filename = os.path.basename(input_file)
        generate_pdf_report(
            points, stats, avg_nn_distance,
            histogram_buf, visualization_buf,
            output_file, original_filename
        )
        
        print("="*60)
        print("REPORT GENERATION COMPLETED SUCCESSFULLY")
        print("="*60 + "\n")
        
        # Output JSON for Node.js to parse
        result = {
            'success': True,
            'output_file': output_file,
            'file_size_mb': round(os.path.getsize(output_file) / (1024 * 1024), 2),
            'point_count': int(stats['count'])
        }
        print("JSON_RESULT:" + json.dumps(result))
        
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        result = {
            'success': False,
            'error': str(e)
        }
        print("JSON_RESULT:" + json.dumps(result))
        sys.exit(1)


if __name__ == "__main__":
    main()
