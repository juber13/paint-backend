import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import bodyParser from 'body-parser'
import mongoose from 'mongoose'
import nodemailer from 'nodemailer'
import Contact from './src/contact.js'
import { v4 as uuidv4 } from 'uuid'

// Load environment variables
dotenv.config()

const app = express()
const port = process.env.PORT || 3000

// Enhanced logging utility
const logger = {
  info: (message, meta = {}) => {
    console.log(`[${new Date().toISOString()}] [INFO] ${message}`, meta)
  },
  error: (message, error = null, meta = {}) => {
    console.error(`[${new Date().toISOString()}] [ERROR] ${message}`, error ? error.stack || error : '', meta)
  },
  warn: (message, meta = {}) => {
    console.warn(`[${new Date().toISOString()}] [WARN] ${message}`, meta)
  },
  debug: (message, meta = {}) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[${new Date().toISOString()}] [DEBUG] ${message}`, meta)
    }
  }
}

// Request ID middleware for tracking requests
app.use((req, res, next) => {
  req.requestId = uuidv4()
  req.startTime = Date.now()
  next()
})

// Request logging middleware
app.use((req, res, next) => {
  const { method, url, ip } = req
  logger.info(`Incoming request`, {
    requestId: req.requestId,
    method,
    url,
    ip,
    userAgent: req.get('User-Agent')
  })
  
  // Log response when it finishes
  res.on('finish', () => {
    const duration = Date.now() - req.startTime
    const { statusCode } = res
    logger.info(`Request completed`, {
      requestId: req.requestId,
      method,
      url,
      statusCode,
      duration: `${duration}ms`
    })
  })
  
  next()
})

// Middleware
app.use(cors({
  origin: "*",
  credentials: true
}))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const connectDB = () => {
  try {
    // Check if MONGODB_URI is provided
    const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paint-contractor'
    
    if (!process.env.MONGODB_URI) {
      logger.warn('MONGODB_URI not set, using default local MongoDB', {
        defaultURI: mongoURI
      })
    }
    
    logger.info('Attempting to connect to MongoDB', {
      uri: mongoURI.replace(/\/\/.*@/, '//***:***@') // Hide credentials in logs
    })
    
    // MongoDB connection
    mongoose.connect(mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .then(() => {
      logger.info('Successfully connected to MongoDB', {
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        port: mongoose.connection.port,
        name: mongoose.connection.name
      })
    })
    .catch((err) => {
      logger.error('MongoDB connection failed', err, {
        errorCode: err.code,
        errorName: err.name,
        mongoURI: mongoURI.replace(/\/\/.*@/, '//***:***@')
      })
      logger.warn('Server will continue with fallback storage')
    })
  } catch (error) {
    logger.error('Database connection setup failed', error)
  }
}


// Fallback in-memory storage if MongoDB is not available
let fallbackContacts = []

// Email transporter configuration
const transporter = nodemailer.createTransport({
  service: 'gmail', // or your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
})

// Routes

// Contact form submission endpoint
app.post('/api/contact', async (req, res) => {
  const requestId = req.requestId
  
  try {
    logger.info('Contact form submission started', {
      requestId,
      body: { ...req.body, message: req.body.message ? '[REDACTED]' : undefined }
    })

    const { name, email, phone, service, message } = req.body

    // Validate required fields
    if (!name || !email || !service || !message) {
      logger.warn('Contact form validation failed - missing required fields', {
        requestId,
        missingFields: {
          name: !name,
          email: !email,
          service: !service,
          message: !message
        }
      })
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields.'
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      logger.warn('Contact form validation failed - invalid email format', {
        requestId,
        email
      })
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.'
      })
    }

    // Save to database (with fallback)
    let savedContact
    try {
      // Check if MongoDB is connected
      if (mongoose.connection.readyState === 1) {
        logger.debug('Attempting to save contact to MongoDB', {
          requestId,
          mongoState: mongoose.connection.readyState
        })
        
        savedContact = await Contact.create({
          name,
          email,
          phone,
          service,
          message
        })
        
        logger.info('Contact successfully saved to MongoDB', {
          requestId,
          contactId: savedContact._id,
          name,
          email,
          service
        })
      } else {
        throw new Error('MongoDB not connected')
      }
    } catch (dbError) {
      logger.warn('MongoDB save failed, using fallback storage', {
        requestId,
        error: dbError.message,
        mongoState: mongoose.connection.readyState
      })
      
      // Fallback to in-memory storage
      savedContact = {
        _id: Date.now().toString(),
        name,
        email,
        phone,
        service,
        message,
        submittedAt: new Date(),
        status: 'new'
      }
      fallbackContacts.push(savedContact)
      
      logger.info('Contact saved to fallback storage', {
        requestId,
        contactId: savedContact._id,
        fallbackCount: fallbackContacts.length
      })
    }
    // Send email notification to admin
    // const adminEmail = process.env.ADMIN_EMAIL || 'info@apnacontractors.com'
    // const mailOptions = {
    //   from: process.env.EMAIL_USER,
    //   to: adminEmail,
    //   subject: `New Contact Form Submission - ${service}`,
    //   html: `
    //     <h2>New Contact Form Submission</h2>
    //     <p><strong>Name:</strong> ${name}</p>
    //     <p><strong>Email:</strong> ${email}</p>
    //     <p><strong>Phone:</strong> ${phone || 'Not provided'}</p>
    //     <p><strong>Service:</strong> ${service}</p>
    //     <p><strong>Message:</strong></p>
    //     <p>${message}</p>
    //     <hr>
    //     <p><small>Submitted at: ${new Date().toLocaleString()}</small></p>
    //   `
    // }

    // // Send auto-reply to customer
    // const customerMailOptions = {
    //   from: process.env.EMAIL_USER,
    //   to: email,
    //   subject: 'Thank you for contacting Apna Contractor',
    //   html: `
    //     <h2>Thank you for your inquiry!</h2>
    //     <p>Dear ${name},</p>
    //     <p>We have received your message regarding <strong>${service}</strong> and will get back to you within 24 hours.</p>
    //     <p>Our team will review your requirements and contact you soon.</p>
    //     <br>
    //     <p>Best regards,<br>Apna Contractors Team</p>
    //     <hr>
    //     <p><small>This is an automated response. Please do not reply to this email.</small></p>
    //   `
    // }

    // try {
    //   await transporter.sendMail(mailOptions)
    //   await transporter.sendMail(customerMailOptions)
    //   console.log('Emails sent successfully')
    // } catch (emailError) {
    //   console.error('Email sending error:', emailError)
    //   // Don't fail the request if email fails
    // }

    logger.info('Contact form submission completed successfully', {
      requestId,
      contactId: savedContact._id,
      name,
      email,
      service
    })

    res.status(200).json({
      success: true,
      message: 'Thank you for your message! We will get back to you within 24 hours.',
      data: {
        id: savedContact._id,
        submittedAt: savedContact.submittedAt
      }
    })

  } catch (error) {
    logger.error('Contact form submission failed', error, {
      requestId,
      body: { ...req.body, message: req.body.message ? '[REDACTED]' : undefined }
    })
    
    res.status(500).json({
      success: false,
      message: 'Sorry, there was an error submitting your message. Please try again later.'
    })
  }
})


// Enhanced error handling middleware
app.use((err, req, res, next) => {
  const requestId = req.requestId || 'unknown'
  
  logger.error('Unhandled error occurred', err, {
    requestId,
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    stack: err.stack
  })
  
  // Don't expose internal errors in production
  const isDevelopment = process.env.NODE_ENV === 'development'
  
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    ...(isDevelopment && { 
      error: err.message,
      requestId 
    })
  })
})

// 404 handler
app.use('*', (req, res) => {
  logger.warn('Route not found', {
    requestId: req.requestId,
    method: req.method,
    url: req.url,
    ip: req.ip
  })
  
  res.status(404).json({
    success: false,
    message: 'Route not found'
  })
})

app.listen(port, () => {
    logger.info('Server started successfully', {
      port,
      nodeEnv: process.env.NODE_ENV || 'development',
      pid: process.pid
    })
    connectDB();
    logger.info('API Documentation available', {
      url: `http://localhost:${port}`
    })
})