'use strict';

const axios = require('axios');
const config = require('../config');

function client(baseURL) {
  const instance = axios.create({
    baseURL,
    timeout: 15000,
  });
  return instance;
}

const businessLogic = client(config.services.businessLogic);
const dataService = client(config.services.dataService);
const notificationService = client(config.services.notificationService);
const monitoringService = client(config.services.monitoringService);
const testAutomationService = client(config.services.testAutomationService);

module.exports = {
  businessLogic,
  dataService,
  notificationService,
  monitoringService,
  testAutomationService,
};
