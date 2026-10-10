const express = require('express');
const Skill = require('../models/Skill');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

// CREATE: নতুন স্কিল যোগ করা (+১ ক্রেডিট প্রদান)
router.post('/', protect, async (req, res) => {
  try {
    const skill = await Skill.create({ ...req.body, user: req.user.id });
    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { credits: 1 } },
      { new: true }
    );
    res.status(201).json({
      ...skill.toObject(),
      userCredits: updatedUser ? updatedUser.credits : undefined,
      creditsAwarded: 1,
      message: 'Skill offer published successfully! +1 Skill Credit awarded.'
    });
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

// DELETE: স্কিল ডিলিট করা (-১ ক্রেডিট কর্তন)
router.delete('/:id', protect, async (req, res) => {
  try {
    const skill = await Skill.findById(req.params.id);
    if (!skill) return res.status(404).json({ message: 'Skill not found' });

    if (skill.user && skill.user.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Unauthorized action' });
    }

    await skill.deleteOne();

    let updatedCredits;
    if (skill.user) {
      const updatedUser = await User.findOneAndUpdate(
        { _id: skill.user, credits: { $gt: 0 } },
        { $inc: { credits: -1 } },
        { new: true }
      );
      if (updatedUser) updatedCredits = updatedUser.credits;
    }

    res.json({
      message: 'Skill deleted successfully. 1 Skill Credit deducted.',
      userCredits: updatedCredits
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;