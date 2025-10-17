# Quant Download File Sharing Application

A full-stack file sharing application built with Node.js/Express backend and Astro/React frontend.

## Features

- **File Upload & Download**: Support for various file types (EXE, REG, PDF, TXT, JPG, PNG)
- **Link Management**: Share download links with descriptions and categories
- **Admin Panel**: Manage files and links with authentication
- **User Authentication**: JWT-based authentication system
- **Responsive UI**: Modern, clean interface built with Tailwind CSS
- **Real-time Progress**: Upload progress tracking
- **File Organization**: Categorize files and links
- **Download Tracking**: Track download counts

## Tech Stack

### Backend
- **Node.js** with **Express.js**
- **MongoDB** with **Mongoose**
- **JWT Authentication**
- **Multer** for file uploads
- **bcryptjs** for password hashing

### Frontend
- **Astro** framework
- **React** components
- **Tailwind CSS** for styling
- **Zustand** for state management
- **Lucide React** for icons

## Local Development

### Prerequisites
- Node.js 18+
- MongoDB database
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Mann-lohchab/Quant_download_file.git
   cd Quant_download_file
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env  # Configure your environment variables
   npm start
   ```

3. **Frontend Setup** (in a new terminal)
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the application**
   - Frontend: http://localhost:4321
   - Backend API: http://localhost:5000

### Environment Variables

Create a `.env` file in the backend directory:

```env
MONGO_URL=mongodb+srv://your-connection-string
JWT_SECRET=your-jwt-secret-key
PORT=5000
CLIENT_URL=http://localhost:4321
MAX_FILE_SIZE=104857600
```

## Deployment

### Backend (Render)

1. Connect your GitHub repository to Render
2. Create a new Web Service
3. Set the following:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Root Directory**: `backend`

4. **Environment Variables** (set in Render dashboard):
   - `NODE_ENV=production`
   - `MONGO_URL=your-mongodb-connection-string`
   - `JWT_SECRET=your-secure-jwt-secret`
   - `CLIENT_URL=https://your-frontend-url.onrender.com`
   - `MAX_FILE_SIZE=104857600`
   - `PORT=10000`

### Frontend (Vercel/Netlify)

1. Build the frontend: `npm run build`
2. Deploy the `dist` folder
3. Update the backend `CLIENT_URL` environment variable

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login

### Files
- `GET /api/files` - Get all files (public)
- `POST /api/files/upload` - Upload file (admin)
- `POST /api/files/upload-link` - Upload link (public)
- `DELETE /api/files/:id` - Delete file (admin)

### Links
- `GET /api/links` - Get all links (authenticated)
- `POST /api/links` - Create link (admin)
- `PUT /api/links/:id` - Update link (admin)
- `DELETE /api/links/:id` - Delete link (admin)

### Categories
- `GET /api/categories/public` - Get categories (public)
- `GET /api/categories` - Get categories (admin)

## Default Credentials

- **Username**: admin
- **Password**: Dfg@2025

## Project Structure

```
├── backend/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── uploads/          # File storage (gitignored)
│   ├── .env             # Environment variables (gitignored)
│   ├── package.json
│   ├── server.js
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── layouts/
│   │   ├── pages/
│   │   ├── stores/
│   │   └── utils/
│   ├── public/
│   └── package.json
├── .gitignore
├── render.yaml          # Render deployment config
└── README.md
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

ISC License - see LICENSE file for details

## Support

For issues and questions, please open an issue on GitHub.
