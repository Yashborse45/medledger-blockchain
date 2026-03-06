const mongoose = require('mongoose');
const { validationResult, param } = require('express-validator');

const formatValidationErrors = (errors) => {
  return errors.map((error) => ({
    field: error.path || error.param || 'unknown',
    message: error.msg,
  }));
};

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) {
    return next();
  }

  return res.status(400).json({
    message: 'Validation failed',
    errors: formatValidationErrors(errors.array()),
  });
};

const validateObjectIdParam = (paramName, label = paramName) =>
  param(paramName).custom((value) => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error(`Invalid ${label}`);
    }
    return true;
  });

module.exports = { handleValidationErrors, validateObjectIdParam };
