const express = require('express');
const Booking = require('../models/Booking');
const User = require('../models/User');
const { protect } = require('../middleware/authMiddleware');
const router = express.Router();

// বুকিং রিকোয়েস্ট তৈরি
router.post('/', protect, async (req, res) => {
  const { skillId, mentorId } = req.body;
  try {
    if (req.user.id === mentorId) {
      return res.status(400).json({ message: 'You cannot book your own skill session' });
    }

    const learner = await User.findById(req.user.id);
    if (learner.credits < 1) {
      return res.status(400).json({ message: 'Insufficient Skill Credits!' });
    }

    const booking = await Booking.create({
      skill: skillId,
      learner: req.user.id,
      mentor: mentorId
    });

    res.status(201).json(booking);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ইউজার বুকিং ডাটা ফেচ করা
router.get('/my-bookings', protect, async (req, res) => {
  try {
    const bookings = await Booking.find({
      $or: [{ learner: req.user.id }, { mentor: req.user.id }]
    }).populate('skill').populate('learner', 'name').populate('mentor', 'name');
    res.json(bookings);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// সেশন কমপ্লিট করে ১ ক্রেডিট ট্রান্সফার করা (Time-Bank Logic)
router.patch('/:id/complete', protect, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: 'Booking not found' });

    if (booking.status === 'Completed') {
      return res.status(400).json({ message: 'Session already completed' });
    }

    const learner = await User.findById(booking.learner);
    if (learner.credits < 1) {
      return res.status(400).json({ message: 'Learner has insufficient credits' });
    }

    // ক্রেডিট লেনদেন: লার্নারের -১ (সর্বনিম্ন ০), মেন্টরের +১
    const updatedLearner = await User.findOneAndUpdate(
      { _id: booking.learner, credits: { $gt: 0 } },
      { $inc: { credits: -1 } },
      { new: true }
    );
    const updatedMentor = await User.findByIdAndUpdate(
      booking.mentor,
      { $inc: { credits: 1 } },
      { new: true }
    );

    booking.status = 'Completed';
    await booking.save();

    res.json({
      message: 'Session completed! 1 Skill Credit transferred.',
      booking,
      mentorCredits: updatedMentor ? updatedMentor.credits : null,
      learnerCredits: updatedLearner ? updatedLearner.credits : 0
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;