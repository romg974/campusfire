// définition du modèle des posts

const mongoose = require('mongoose');

const contentSchema = mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    auto: true,
  },
  type: {
    type: String,
    enum: ['TEXT', 'MEDIA', 'EMBEDED'],
    default: 'TEXT',
  },
  payload: String,
  createdOn: { type: Date, default: Date.now },
  deletedOn: { type: Date, default: null },
  lifetime: { type: Number, default: 40 },
  author_id: { type: String, default: null},
  position: {
    x: Number,
    y: Number,
    z: Number,
  },
  display: { type: mongoose.Schema.Types.ObjectId, ref: 'Display' },
});

module.exports = mongoose.model('Content', contentSchema);
