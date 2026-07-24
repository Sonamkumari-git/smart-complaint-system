const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate, authorize('ADMIN'));

router.get('/users', ctrl.listUsers);
router.post('/users', ctrl.createStaff);
router.patch('/users/:id', ctrl.updateUser);

router.get('/departments', ctrl.listDepartments);
router.post('/departments', ctrl.createDepartment);

router.get('/categories', ctrl.listCategories);
router.post('/categories', ctrl.createCategory);

router.get('/priorities', ctrl.listPriorities);
router.get('/analytics', ctrl.analytics);
router.get('/ai-health', ctrl.aiHealth);

module.exports = router;
