const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const ctrl = require('../controllers/complaintController');
const { authenticate, authorize } = require('../middleware/auth');

// File upload setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (req, file, cb) => {
    if (/^image\/(jpeg|png|gif|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

router.use(authenticate);

router.post('/predict', ctrl.predictOnly);
router.post('/', upload.single('image'), ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);

router.patch('/:id', authorize('USER'), ctrl.updateOwn);
router.delete('/:id', authorize('USER'), ctrl.deleteOwn);
router.patch('/:id/status', authorize('STAFF','ADMIN'), ctrl.updateStatus);
router.patch('/:id/assign', authorize('ADMIN'), ctrl.assign);
router.post('/:id/comments', ctrl.addComment);
router.post('/:id/rate', authorize('USER'), ctrl.rate);
router.post('/:id/reopen', authorize('USER'), ctrl.reopen);

module.exports = router;
