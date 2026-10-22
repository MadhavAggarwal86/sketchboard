const mongoose = require('mongoose');

const canvasSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    maxlength: 100,
    default: 'Untitled canvas'
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  shared: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  elements: [{
    type: mongoose.Schema.Types.Mixed
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Canvas', canvasSchema);
