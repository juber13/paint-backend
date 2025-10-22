import mongoose from 'mongoose';

const contactSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true,
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    trim: true,
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: { 
    type: String, 
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^[\+]?[1-9][\d]{0,15}$/.test(v);
      },
      message: 'Please enter a valid phone number'
    }
  },
  service: { 
    type: String, 
    required: [true, 'Service is required'],
    trim: true,
    enum: {
      values: [
        'Interior Painting',
        'Exterior Painting', 
        'Waterproofing',
        'POP Work',
        'Tile Installation',
        'Civil Work',
        'Carpenter Work'
      ],
      message: 'Please select a valid service'
    }
  },
  message: { 
    type: String, 
    required: [true, 'Message is required'],
    trim: true,
    minlength: [10, 'Message must be at least 10 characters'],
    maxlength: [1000, 'Message cannot exceed 1000 characters']
  },
  submittedAt: { 
    type: Date, 
    default: Date.now 
  },
});


const Contact = mongoose.model('Contact', contactSchema);

export default Contact;