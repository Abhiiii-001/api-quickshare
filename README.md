# Backend API Documentation

## Overview
This is the backend service for the RapidShare application. It provides various endpoints for file handling and management.

## Setup
To set up the backend, follow these steps:

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd RapidShare/backend
   ```

2. **Install dependencies**:
   Make sure you have [Node.js](https://nodejs.org/) installed. Then run:
   ```bash
   npm install
   ```
   or if you are using Bun:
   ```bash
   bun install
   ```

3. **Environment Variables**:
   Create a `.env` file in the root of the backend directory and add the necessary environment variables. You can refer to the `.env.example` file for required variables.

4. **Run the application**:
   ```bash
   npm run dev
   ```
   or if you are using Bun:
   ```bash
   bun dev
   ```

## Endpoints

### 1. File Upload
- **POST** `/api/files/upload`
- **Description**: Upload a file to the server.
- **Request Body**: FormData containing the file.
- **Response**: Returns the uploaded file details.

### 2. File Retrieval
- **GET** `/api/files/:id`
- **Description**: Retrieve a file by its ID.
- **Response**: Returns the file details.

### 3. File Deletion
- **DELETE** `/api/files/:id`
- **Description**: Delete a file by its ID.
- **Response**: Returns a success message.

### 4. List Files
- **GET** `/api/files`
- **Description**: Retrieve a list of all uploaded files.
- **Response**: Returns an array of file details.

## License
This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

---

For more information, please refer to the documentation or contact the development team.

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

This project was created using `bun init` in bun v1.1.29. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
