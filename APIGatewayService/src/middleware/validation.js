'use strict';

const { body, param, query, validationResult } = require('express-validator');

// PUBLIC_INTERFACE
function handleValidationErrors(req, res, next) {
  /** Middleware to handle validation errors */
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      status: 'error',
      message: 'Invalid request body',
      details: {
        errors: errors.array()
      },
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }
  next();
}

// Validation rules for different endpoints
const validationRules = {
  // Authentication validations
  login: [
    body('username')
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 1, max: 255 })
      .withMessage('Username must be 1-255 characters'),
    body('password')
      .notEmpty()
      .withMessage('Password is required')
      .isLength({ min: 1, max: 255 })
      .withMessage('Password must be 1-255 characters')
  ],

  // User validations
  createUser: [
    body('username')
      .notEmpty()
      .withMessage('Username is required')
      .isLength({ min: 1, max: 255 })
      .withMessage('Username must be 1-255 characters'),
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('name')
      .notEmpty()
      .withMessage('Name is required')
      .isLength({ min: 1, max: 255 })
      .withMessage('Name must be 1-255 characters'),
    body('roles')
      .optional()
      .isArray()
      .withMessage('Roles must be an array')
      .custom((roles) => {
        const validRoles = ['admin', 'user', 'support', 'manager'];
        const invalidRoles = roles.filter(role => !validRoles.includes(role));
        if (invalidRoles.length > 0) {
          throw new Error(`Invalid roles: ${invalidRoles.join(', ')}`);
        }
        return true;
      }),
    body('active')
      .optional()
      .isBoolean()
      .withMessage('Active must be a boolean')
  ],

  // Order validations
  createOrder: [
    body('customerId')
      .notEmpty()
      .withMessage('Customer ID is required'),
    body('items')
      .isArray({ min: 1 })
      .withMessage('Items must be a non-empty array'),
    body('items.*.sku')
      .notEmpty()
      .withMessage('SKU is required for each item'),
    body('items.*.qty')
      .isInt({ min: 1 })
      .withMessage('Quantity must be a positive integer'),
    body('items.*.price')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Price must be a non-negative number'),
    body('totalAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('Total amount must be non-negative')
  ],

  // Customer validations
  createCustomer: [
    body('firstName')
      .notEmpty()
      .withMessage('First name is required')
      .isLength({ min: 1, max: 100 })
      .withMessage('First name must be 1-100 characters'),
    body('lastName')
      .notEmpty()
      .withMessage('Last name is required')
      .isLength({ min: 1, max: 100 })
      .withMessage('Last name must be 1-100 characters'),
    body('email')
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('phone')
      .optional()
      .isLength({ max: 20 })
      .withMessage('Phone must be max 20 characters')
  ],

  // Support ticket validations
  createSupportTicket: [
    body('customerId')
      .notEmpty()
      .withMessage('Customer ID is required'),
    body('subject')
      .notEmpty()
      .withMessage('Subject is required')
      .isLength({ min: 1, max: 255 })
      .withMessage('Subject must be 1-255 characters'),
    body('description')
      .notEmpty()
      .withMessage('Description is required')
      .isLength({ min: 1, max: 5000 })
      .withMessage('Description must be 1-5000 characters'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('Priority must be one of: low, medium, high, critical'),
    body('category')
      .optional()
      .isLength({ max: 100 })
      .withMessage('Category must be max 100 characters')
  ],

  // Notification validations
  sendNotification: [
    body('recipient')
      .notEmpty()
      .withMessage('Recipient is required'),
    body('message')
      .notEmpty()
      .withMessage('Message is required')
      .isLength({ min: 1, max: 5000 })
      .withMessage('Message must be 1-5000 characters'),
    body('type')
      .isIn(['email', 'sms'])
      .withMessage('Type must be either email or sms'),
    body('subject')
      .optional()
      .isLength({ max: 255 })
      .withMessage('Subject must be max 255 characters'),
    body('templateId')
      .optional()
      .notEmpty()
      .withMessage('Template ID cannot be empty if provided'),
    body('parameters')
      .optional()
      .isObject()
      .withMessage('Parameters must be an object')
  ],

  // Parameter validations
  userId: [
    param('id')
      .notEmpty()
      .withMessage('User ID is required')
  ],

  // Query parameter validations
  pagination: [
    query('page')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Page must be a positive integer'),
    query('limit')
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage('Limit must be between 1 and 100')
  ]
};

// PUBLIC_INTERFACE
function validate(ruleName) {
  /** Get validation rules by name */
  return validationRules[ruleName] || [];
}

module.exports = {
  handleValidationErrors,
  validate,
  validationRules
};
