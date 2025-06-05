const mongoose = require('mongoose');

// Define the Comment Schema
const commentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },  
  username: { type: String, required: true },  
  text: String,
  createdAt: { type: Date, default: Date.now }
});

// Define the Post Schema
const postSchema = new mongoose.Schema({
  title: String,
  body: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  comments: [commentSchema], 
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]  
});

module.exports = mongoose.model('Post', postSchema);
