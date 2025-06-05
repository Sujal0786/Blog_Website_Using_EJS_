const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const User = require('../models/User');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const adminLayout = '../views/layouts/admin';
const jwtSecret = process.env.JWT_SECRET;

const authMiddleware = (req, res, next) => {
  const token = req.cookies.token;
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    const decoded = jwt.verify(token, jwtSecret);
    req.userId = decoded.userId;
    res.locals.userId = decoded.userId; 
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

// ------------------ ADMIN LOGIN PAGE ------------------
router.get('/admin', (req, res) => {
  res.render('admin/index', {
    locals: {
      title: "Admin",
      description: "Simple Blog created with NodeJs, Express & MongoDb.",
      userId: res.locals.userId 
    },
    layout: adminLayout
  });
});

// ------------------ HANDLE LOGIN ------------------
router.post('/admin', async (req, res) => {
  const { username, password } = req.body;
  const user = await User.findOne({ username });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user._id }, jwtSecret);
  res.cookie('token', token, { httpOnly: true });
  res.redirect('/dashboard');
});


// ------------------ DASHBOARD ------------------
router.get('/dashboard', authMiddleware, async (req, res) => {
  try {
    const posts = await Post.find()
      .populate('comments.user', 'username') 
      .exec();

    res.render('admin/dashboard', {
      locals: { title: 'Dashboard', description: 'Simple Blog' },
      data: posts,  
      userId: res.locals.userId,  
      layout: adminLayout
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching posts');
  }
});


// ------------------ ADD POST FORM ------------------
router.get('/add-post', authMiddleware, (req, res) => {
  res.render('admin/add-post', { title: 'Add Post', layout: adminLayout });
});

// ------------------ ADD POST (SUBMIT) ------------------
router.post('/add-post', authMiddleware, async (req, res) => {
  await Post.create({
    title: req.body.title,
    body: req.body.body,
    createdAt: Date.now(),
    updatedAt: Date.now()
  });
  res.redirect('/dashboard');
});

// ------------------ EDIT POST FORM ------------------
router.get('/edit-post/:id', authMiddleware, async (req, res) => {
  const data = await Post.findById(req.params.id);
  res.render('admin/edit-post', { title: "Edit Post", data, layout: adminLayout });
});

// ------------------ UPDATE POST ------------------
router.put('/edit-post/:id', authMiddleware, async (req, res) => {
  await Post.findByIdAndUpdate(req.params.id, {
    title: req.body.title,
    body: req.body.body,
    updatedAt: Date.now()
  });
  res.redirect(`/edit-post/${req.params.id}`);
});

// ------------------ DELETE POST ------------------
router.delete('/delete-post/:id', authMiddleware, async (req, res) => {
  await Post.findByIdAndDelete(req.params.id);
  res.redirect('/dashboard');
});

// ------------------ LOGOUT ------------------
router.get('/logout', (req, res) => {
  res.clearCookie('token');
  res.redirect('/');
});

// ------------------ USER REGISTRATION ------------------
router.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (await User.findOne({ username })) {
    return res.status(409).json({ message: 'Username already in use' });
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({ username, password: hashed });
  res.status(201).json({ message: 'User Created', user });
});

// ------------------ POST DETAILS PAGE ------------------
router.get('/post/:id', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate('comments.user', 'username') 
      .populate('likes', 'username'); 

    res.render('post', {
      post, 
      userId: res.locals.userId, 
      layout: '../views/layouts/main'
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Error fetching post details');
  }
});



// ------------------ LIKE/UNLIKE POST ------------------
router.post('/post/:id/like', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    const userId = res.locals.userId;

    if (!post) return res.status(404).send('Post not found');

    const liked = post.likes.includes(userId);
    if (!liked) {
      post.likes.push(userId);
    } else {
      post.likes = post.likes.filter(id => id.toString() !== userId);
    }

    await post.save();
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send('Error toggling like');
  }
});



// ------------------ ADD COMMENT ------------------
router.post('/post/:id/comment', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) return res.status(404).send('Post not found');

    // Check if the comment text is provided
    if (!req.body.comment || req.body.comment.trim() === '') {
      return res.status(400).send('Comment text is required');
    }

    const userId = res.locals.userId;
    
    // Fetch the user to get their username
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).send('User not found');
    }

    // Create a new comment with the username
    const newComment = {
      user: userId,  
      username: user.username,  
      text: req.body.comment.trim(),
    };

    // Push the new comment into the post's comments array
    post.comments.push(newComment);

    // Save the post with the new comment
    await post.save();

    // Redirect back to the post page to display the new comment
    res.redirect("/");
    // res.redirect
  } catch (err) {
    console.error(err);
    res.status(500).send('Error adding comment');
  }
});


// ------------------ DELETE COMMENT ------------------
router.post('/post/:postId/comment/:commentId/delete', authMiddleware, async (req, res) => {
  const { postId, commentId } = req.params;
  const username = req.body.username; 

  try {
    // Find the post by its ID
    const post = await Post.findById(postId);

    // Check if the post exists
    if (!post) {
      return res.status(404).send('Post not found');
    }

    // Find the comment by its ID
    const comment = post.comments.id(commentId);

    if (!comment) {
      return res.status(404).send('Comment not found');
    }

    // If the username is provided, check if the comment's username matches
    if (username && comment.username !== username) {
      return res.status(403).send('You are not authorized to delete this comment');
    }

    // Otherwise, check if the user is authorized to delete the comment (by comment's user ID)
    if (comment.user.toString() !== res.locals.userId.toString()) {
      return res.status(403).send('You are not authorized to delete this comment');
    }

    // Remove the comment using pull() from the comments array
    post.comments.pull({ _id: commentId });

    // Save the updated post
    await post.save();

    
    res.redirect("/");
  } catch (err) {
    console.error(err);
    res.status(500).send('Error deleting comment');
  }
});


module.exports = router;
