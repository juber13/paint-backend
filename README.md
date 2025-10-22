# Apna Contractor Backend API

Backend API server for Apna Contractor paint services website.

## Features

- ✅ Contact form submission with validation
- ✅ MongoDB database integration
- ✅ Email notifications (admin + auto-reply)
- ✅ CORS enabled for frontend
- ✅ Error handling and logging
- ✅ Admin endpoints for contact management

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Variables

Create a `.env` file in the backend directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/paint-contractor

# Email Configuration (Gmail)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
ADMIN_EMAIL=admin@apnacontractors.com

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:5173
```

### 3. Database Setup

Make sure MongoDB is running on your system:
- Local: `mongodb://localhost:27017/paint-contractor`
- Cloud: Update `MONGODB_URI` with your MongoDB Atlas connection string

### 4. Email Setup (Gmail)

1. Enable 2-factor authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account settings
   - Security → 2-Step Verification → App passwords
   - Generate password for "Mail"
3. Use the app password in `EMAIL_PASS`

### 5. Run the Server

```bash
# Development
npm run dev

# Production
npm start
```

## API Endpoints

### Contact Form
- `POST /api/contact` - Submit contact form
- `GET /api/contacts` - Get all contacts (admin)
- `PUT /api/contacts/:id` - Update contact status (admin)

### General
- `GET /` - Server status
- `GET /health` - Health check
- `GET /api/services` - Get available services
- `GET /api/contact-info` - Get contact information

## Contact Form Data Structure

```json
{
  "name": "string (required)",
  "email": "string (required)",
  "phone": "string (optional)",
  "service": "string (required)",
  "message": "string (required)"
}
```

## Response Format

```json
{
  "success": true,
  "message": "Thank you for your message! We will get back to you within 24 hours.",
  "data": {
    "id": "contact_id",
    "submittedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Database Schema

### Contact Collection
```javascript
{
  name: String (required),
  email: String (required),
  phone: String (optional),
  service: String (required),
  message: String (required),
  submittedAt: Date (default: now),
  status: String (default: 'new') // new, contacted, completed
}
```

## Email Templates

### Admin Notification
- Subject: "New Contact Form Submission - {service}"
- Contains all form data and submission timestamp

### Customer Auto-Reply
- Subject: "Thank you for contacting Apna Contractor"
- Personalized message with service details

## Error Handling

All endpoints include proper error handling:
- Validation errors (400)
- Server errors (500)
- Not found errors (404)

## CORS Configuration

Configured to allow requests from:
- Development: `http://localhost:5173`
- Production: Set `FRONTEND_URL` environment variable

## Production Deployment

1. Update environment variables for production
2. Use MongoDB Atlas for database
3. Configure proper email service
4. Set up SSL/HTTPS
5. Configure reverse proxy (nginx)
6. Set up monitoring and logging
