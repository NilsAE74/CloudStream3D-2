# CloudStream3D-2

A modern web application for visualizing and processing XYZ point cloud data. Upload files, view interactive 3D visualizations, filter and analyze data with measurements and histograms. Offers transformations (invert Z, shift, rotation) and export of filtered datasets.

## Features

### Core Features (MVP)
- ✅ **File Upload**: Drag & Drop support for CSV/XYZ/TXT files
- ✅ **3D Visualization**: Interactive point cloud rendering using Three.js (rotation, zoom, pan)
- ✅ **Basic Statistics**: Display min/max X, Y, Z values and point count
- ✅ **Dynamic Filtering**: Real-time filtering with sliders for X, Y, Z ranges

### Advanced Features
- ✅ **Histogram Visualization**: Z-value distribution using Chart.js
- 🔧 **Measurement Tool**: UI placeholder for point selection and distance calculation (requires future implementation)
- ✅ **Data Export**: Export filtered datasets as CSV or XYZ format
- ✅ **Data Transformations**:
  - Invert Z-values (toggle)
  - Shift data by ΔX, ΔY, ΔZ
  - Rotate data around X, Y, Z axes (in degrees)

### UI Features
- ✅ **Responsive Three-Panel Layout**:
  - **Left Panel**: File upload with drag-and-drop and file list
  - **Center Panel**: 3D visualization with floating toolbar
  - **Right Panel**: Statistics, histogram, filtering sliders, transformation controls, export options
- ✅ **Interactive Toolbar**: Reset view, color modes (height-based/uniform), measurement tool
- ✅ **Dark Theme**: Modern Material-UI design with professional styling

## Tech Stack

### Frontend
- **React** - UI framework
- **Three.js** (@react-three/fiber, @react-three/drei) - 3D visualization
- **Chart.js** (react-chartjs-2) - Data visualization
- **Material-UI** (@mui/material) - Component library and styling
- **Axios** - HTTP client

### Backend
- **Node.js** with **Express** - Server framework
- **Multer** - File upload handling
- **PapaParse** - CSV parsing
- **CORS** - Cross-origin resource sharing

## Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Setup Instructions

1. **Clone the repository**:
```bash
git clone https://github.com/NilsAE74/CloudStream3D-2.git
cd CloudStream3D-2
```

2. **Install dependencies**:
```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

3. **Configure environment** (optional):
   
   Edit `client/.env` to change the API URL if needed:
```
REACT_APP_API_URL=http://localhost:5000
```

## Running the Application

### Development Mode

**Option 1: Run both frontend and backend simultaneously**:
```bash
npm run dev
```

**Option 2: Run separately**:

Terminal 1 (Backend):
```bash
npm run server
```

Terminal 2 (Frontend):
```bash
npm run client
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### Production Build

1. **Build the frontend**:
```bash
npm run build
```

2. **Start the server**:
```bash
npm start
```

## Usage Guide

### 1. Upload Point Cloud Data
- **Drag and drop** a CSV, XYZ, or TXT file into the left panel upload area
- Or click the upload area to **browse** for a file
- Supported formats:
  - **CSV**: Headers like `x,y,z` or `X,Y,Z` or numeric columns
  - **XYZ**: Space or tab-separated values: `x y z`
  - **TXT**: Same as XYZ format

### 2. Visualize Data
- The center panel displays the 3D point cloud
- **Mouse controls**:
  - **Left click + drag**: Rotate view
  - **Right click + drag**: Pan view
  - **Scroll wheel**: Zoom in/out
- Use toolbar buttons:
  - **Reset View**: Return to default camera position
  - **Color Mode**: Toggle between height-based coloring and uniform color
  - **Measurement**: Enable/disable measurement mode

### 3. Analyze Data
The right panel provides various analysis tools:

#### Statistics
- View point count and ranges for X, Y, Z axes

#### Histogram
- Visualize Z-value distribution across 20 bins

#### Measurement
- Enable measurement mode from toolbar
- Click two points in the 3D view
- See the 3D Euclidean distance between points

### 4. Filter Data
- Use sliders to adjust X, Y, Z range filters
- Click "Apply Filter" to update the visualization
- Filtered statistics update automatically

### 5. Transform Data
Apply various transformations:
- **Invert Z**: Flip Z-values (multiply by -1)
- **Shift**: Move all points by ΔX, ΔY, ΔZ
- **Rotate**: Rotate around X, Y, or Z axes (in degrees)
- Click "Apply Transformations" to execute

### 6. Export Data
- Export the currently filtered dataset
- Choose format: CSV or XYZ
- File downloads automatically

## Project Structure

```
CloudStream3D-2/
├── client/                      # React frontend
│   ├── public/                  # Static assets
│   ├── src/
│   │   ├── components/
│   │   │   ├── LeftPanel/      # File upload component
│   │   │   ├── CenterPanel/    # 3D visualization component
│   │   │   ├── RightPanel/     # Analysis and controls component
│   │   │   └── ToolBar/        # Floating toolbar component
│   │   ├── App.js              # Main application component
│   │   ├── App.css             # Global styles
│   │   └── index.js            # React entry point
│   ├── package.json
│   └── .env                     # Environment variables
├── server/                      # Node.js backend
│   ├── utils/
│   │   ├── transformations.js  # Point cloud transformation utilities
│   │   └── sampling.js         # Advanced downsampling algorithms
│   └── index.js                # Express server and API endpoints
├── uploads/                     # Uploaded files (gitignored)
├── package.json                 # Root package configuration
├── .gitignore
└── README.md
```

## API Endpoints

### `POST /api/upload`
Upload a point cloud file
- **Body**: FormData with `file` field
- **Query Parameters**:
  - `downsamplingEnabled`: boolean (default: false)
  - `maxDisplayPoints`: number (default: 2500000)
  - `samplingAlgorithm`: 'simple' | 'importance' | 'poisson' (default: 'simple')
- **Returns**: Parsed point data, statistics, and metadata

### `POST /api/transform`
Apply transformations to point cloud
- **Body**: `{ points: Array, operations: Object }`
- **Returns**: Transformed points and updated statistics

### `POST /api/filter`
Filter points by range
- **Body**: `{ points: Array, ranges: Object }`
- **Returns**: Filtered points and statistics

### `POST /api/export`
Export point cloud data
- **Body**: `{ points: Array, format: String }`
- **Returns**: File download (CSV or XYZ)

## Development

### Code Structure
- **Modular Components**: Each UI section is a separate React component
- **State Management**: React hooks (useState, useCallback, useMemo) for efficient rendering
- **API Integration**: Axios for backend communication
- **3D Rendering**: React Three Fiber for declarative Three.js usage

### Key Technologies
- **@react-three/fiber**: React renderer for Three.js
- **@react-three/drei**: Useful helpers for R3F (OrbitControls, PerspectiveCamera)
- **Chart.js**: Flexible charting library
- **Material-UI**: Pre-built React components with theming

## Performance Considerations

### Point Downsampling
The application now features intelligent downsampling algorithms to handle large point clouds efficiently:

#### Downsampling Options (Right Panel - Display Settings)
- **Enable/Disable**: Toggle downsampling on/off (disabled by default)
- **Max Display Points**: Dynamic slider that adjusts to your file size
  - Automatically scales from 1% to 100% of your file
  - Shows total points in file for context
  - Changes apply to newly uploaded files
- **Sampling Algorithms**:
  1. **Simple (Every Nth point)**: Fast, uniform sampling
     - Selects every Nth point based on target count
     - Best for: Quick previews, uniform data
  
  2. **Importance Sampling**: Preserves geometric features
     - Prioritizes areas with high z-variation
     - Uses spatial indexing and k-nearest neighbors
     - Best for: Terrain with complex features, detailed surfaces
     - Performance: ~100ms for 10k points, ~9s for 100k points
  
  3. **Poisson Disk Sampling**: Evenly distributed points
     - Ensures minimum distance between points
     - Uses Bridson's algorithm for natural spacing
     - Best for: Uniform density, aesthetic visualization
     - Performance: ~170ms for 10k points, ~5s for 100k points

#### When to Use Downsampling
- **Enable**: For files with millions of points where performance is critical
- **Disable**: For smaller files (<500k points) or when full detail is needed
- **Algorithm Selection**:
  - Use **Simple** for quick testing and uniform data
  - Use **Importance** when you need to preserve terrain features and details
  - Use **Poisson** when you want even distribution and natural appearance

### Other Performance Features
- **Client-side Filtering**: Filtering happens in the browser for better responsiveness
- **Efficient Rendering**: Three.js handles GPU-accelerated point cloud rendering
- **Lazy Loading**: Components load data only when needed
- **Debounced Controls**: Slider updates are debounced (400ms) to prevent excessive re-renders

## Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge

Requires WebGL support for 3D visualization.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License

## Author

NilsAE74

## Acknowledgments

- Three.js community for excellent 3D rendering capabilities
- React Three Fiber for making Three.js more accessible in React
- Material-UI for beautiful React components
