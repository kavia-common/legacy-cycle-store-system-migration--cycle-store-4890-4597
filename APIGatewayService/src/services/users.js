const bcrypt = require('bcryptjs');

/**
 * Demo users in memory. In production, integrate with Identity Provider or User Service.
 * Passwords (plaintext -> hash):
 * - admin / admin123
 * - staff / staff123
 * - viewer / viewer123
 */
const seedUsers = () => {
  const users = [
    { id: '1', username: 'admin', name: 'Admin User', email: 'admin@example.com', roles: ['admin', 'staff', 'viewer'], password: 'admin123' },
    { id: '2', username: 'staff', name: 'Staff User', email: 'staff@example.com', roles: ['staff', 'viewer'], password: 'staff123' },
    { id: '3', username: 'viewer', name: 'Viewer User', email: 'viewer@example.com', roles: ['viewer'], password: 'viewer123' },
  ];
  return users.map(u => ({ ...u, passwordHash: bcrypt.hashSync(u.password, 10), password: undefined }));
};

const USERS = seedUsers();

// PUBLIC_INTERFACE
function findByUsername(username) {
  /** Finds user by username (case sensitive). */
  return USERS.find((u) => u.username === username) || null;
}

// PUBLIC_INTERFACE
async function verifyPassword(user, password) {
  /** Verifies plaintext password against stored hash. */
  if (!user || !user.passwordHash) return false;
  return bcrypt.compare(password, user.passwordHash);
}

module.exports = { findByUsername, verifyPassword };
