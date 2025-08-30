// Common utility functions shared across all domains and applications

export const formatDate = (date: Date): string => {
  return date.toISOString().split('T')[0] || '';
};

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
};

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
