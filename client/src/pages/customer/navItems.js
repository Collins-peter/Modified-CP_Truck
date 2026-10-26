// Shared across every customer page so the sidebar links (and the
// active-state highlighting in DashboardLayout) stay consistent
// without duplicating this array in each page file.
export const customerNavItems = [
  { label: 'Overview', path: '/customer/dashboard', icon: 'overview' },
  { label: 'New Request', path: '/customer/requests/new', icon: 'newRequest' },
  { label: 'My Requests', path: '/customer/requests', icon: 'myRequests' },
  { label: 'Track Package', path: '/customer/track', icon: 'track' },
  { label: 'Chat Support', path: '/customer/chat', icon: 'chat' },
];
