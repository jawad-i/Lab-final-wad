const express = require('express');
const Skill = require('../models/Skill');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

// CREATE: নতুন স্কিল যোগ করা
router.post('/', protect, async (req, res) => {
  try {
    const skill = await Skill.create({ ...req.body, user: req.user.id });
    res.status(201).json(skill);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// READ: সকল স্কিল দেখা (সার্চ এবং ক্যাটাগরি ফিল্টার সহ)
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = {};
    if (category) query.category = category;
    if (search) query.title = { $regex: search, $options: 'i' };

    const skills = await Skill.find(query).populate('user', 'name credits');
    res.json(skills);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE: স্কিল ডিলিট করা
router.delete('/:id', protect, async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) return res.status(404).json({ message: 'Skill not found' });

    if (skill.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized action' });
    }

    await skill.deleteOne();
    res.json({ message: 'Skill deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;