# Deployment Guide for NexHealth Pro

This guide explains how to deploy NexHealth Pro to Render.

## Prerequisites

- A Render account (free tier available)
- Your project pushed to a Git repository (GitHub, GitLab, etc.)

## Deployment Steps

1. **Push to Git Repository**
   ```bash
   git add .
   git commit -m "Initial commit"
   git remote add origin <your-repo-url>
   git push -u origin master
   ```

2. **Create Render Web Service**
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click "New" > "Web Service"
   - Connect your Git repository
   - Configure the service:
     - **Name**: nexhealth-pro (or your choice)
     - **Environment**: Node
     - **Build Command**: `npm install`
     - **Start Command**: `npm start`
     - **Node Version**: 18 or latest LTS

3. **Environment Variables** (Optional)
   - No environment variables are required for basic deployment
   - The app uses `process.env.PORT` automatically

4. **Database Notes**
   - SQLite database is created locally on Render's file system
   - **Important**: Data will not persist across deployments since Render uses ephemeral storage
   - For production use, consider migrating to a persistent database like PostgreSQL

5. **Deploy**
   - Click "Create Web Service"
   - Render will build and deploy your app
   - Once deployed, you'll get a URL like `https://nexhealth-pro.onrender.com`

## Accessing the Application

- **Homepage**: `https://your-render-url.onrender.com`
- **Patient Login**: Register or login as a patient
- **Doctor Login**: Use credentials `doctor1/pass123`, `doctor2/pass123`, or `doctor3/pass123`

## Troubleshooting

- If the build fails, check the logs in Render dashboard
- Ensure all dependencies are listed in `package.json`
- For database issues, check if SQLite is properly initialized

## Security Notes

- This is a demo application
- In production, implement proper authentication and secure doctor credentials
- Consider adding HTTPS and other security measures