import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import bodyParser from 'body-parser'
import mongoose from 'mongoose'
import nodemailer from 'nodemailer'
import Contact from './contact.js'

// Load environment variables
dotenv.config()

const app = express()
const port = process.env.PORT || 3000

// Middleware
app.use(cors({
  origin: "*",
  credentials: true
}))
app.use(bodyParser.json())
app.use(bodyParser.urlencoded({ extended: true }))

const connectDB = () => {
  // Check if MONGODB_URI is provided
  const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/paint-contractor'
  
  if (!process.env.MONGODB_URI) {
    console.log('⚠️  MONGODB_URI not set, using default local MongoDB')
  }
  
  // MongoDB connection
  mongoose.connect(mongoURI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
  })
  .then(() => {
    console.log('✅ Connected to MongoDB')
  })
  .catch((err) => {
    console.log('❌ MongoDB connection error:', err.message)
    console.log('📝 Server will continue with fallback storage')
  })
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
app.get('/', (req, res) => {
  res.json({ 
    message: 'Apna Contractor API Server', 
    status: 'running',
    version: '1.0.0',
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  })
})

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  })
})

// Contact form submission endpoint
app.post('/api/contact', async (req, res) => {
  try {
    const { name, email, phone, service, message } = req.body

    // Validate required fields
    if (!name || !email || !service || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields.'
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
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
        savedContact = await Contact.create({
          name,
          email,
          phone,
          service,
          message
        })
        console.log('✅ Contact saved to MongoDB:', savedContact._id)
      } else {
        throw new Error('MongoDB not connected')
      }
    } catch (dbError) {
      console.log('⚠️  MongoDB save failed, using fallback storage:', dbError.message)
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
      console.log('✅ Contact saved to fallback storage')
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

    res.status(200).json({
      success: true,
      message: 'Thank you for your message! We will get back to you within 24 hours.',
      data: {
        id: savedContact._id,
        submittedAt: savedContact.submittedAt
      }
    })

  } catch (error) {
    console.error('Contact form submission error:', error)
    res.status(500).json({
      success: false,
      message: 'Sorry, there was an error submitting your message. Please try again later.'
    })
  }
})

// Get all contacts (admin endpoint)
app.get('/api/contacts', async (req, res) => {
  try {
    let contacts = []
    
    if (mongoose.connection.readyState === 1) {
      // Try to get from MongoDB
      try {
        contacts = await Contact.find().sort({ submittedAt: -1 })
        console.log('✅ Fetched contacts from MongoDB')
      } catch (dbError) {
        console.log('⚠️  MongoDB fetch failed, using fallback storage')
        contacts = fallbackContacts.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      }
    } else {
      // Use fallback storage
      contacts = fallbackContacts.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
      console.log('📝 Using fallback storage for contacts')
    }
    
    res.json({
      success: true,
      data: contacts,
      source: mongoose.connection.readyState === 1 ? 'mongodb' : 'fallback'
    })
  } catch (error) {
    console.error('Error fetching contacts:', error)
    res.status(500).json({
      success: false,
      message: 'Error fetching contacts'
    })
  }
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({
    success: false,
    message: 'Something went wrong!'
  })
})

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  })
})

app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
    connectDB();
    console.log(`API Documentation: http://localhost:${port}`)
})