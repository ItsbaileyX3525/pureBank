interface Order {
  id: number;
  user_id: number;
  username: string;
  description: string;
  amount: number;
  delivery_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  created_at: string;
}

interface User {
  id: number;
  username: string;
  profile_image_url: string;
  created_at: string;
}

class AdminPanel {
  private currentTab = 'all';
  private currentFilter = '';
  private isAuthenticated = false;

  constructor() {
    this.init();
  }

  private async init(): Promise<void> {
    await this.checkAuthStatus();
    this.bindEvents();
  }

  private async checkAuthStatus(): Promise<void> {
    try {
      const response = await fetch('/admin/status');
      const data = await response.json();
      
      if (data.success && data.isAuthenticated) {
        this.isAuthenticated = true;
        this.showAdminPanel();
        this.loadOrders();
      } else {
        this.isAuthenticated = false;
        this.showAuthForm();
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
      this.isAuthenticated = false;
      this.showAuthForm();
    }
  }

  private bindEvents(): void {
    const authForm = document.getElementById('admin-auth-form');
    const logoutBtn = document.getElementById('logout-btn');
    const searchInput = document.getElementById('search-input');
    const tabButtons = document.querySelectorAll('.tab-button');

    authForm?.addEventListener('submit', this.handleAuth.bind(this));
    logoutBtn?.addEventListener('click', this.handleLogout.bind(this));
    searchInput?.addEventListener('input', this.handleSearch.bind(this));

    tabButtons.forEach(btn => {
      btn.addEventListener('click', this.handleTabChange.bind(this));
    });
  }

  private async handleAuth(e: Event): Promise<void> {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const password = formData.get('admin-password') as string;
    const submitButton = form.querySelector('button[type="submit"]') as HTMLButtonElement;
    
    // Show loading state
    const originalText = submitButton.textContent;
    submitButton.textContent = 'Authenticating...';
    submitButton.disabled = true;

    try {
      const response = await fetch('/admin/auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (data.success) {
        this.isAuthenticated = true;
        this.showAdminPanel();
        this.loadOrders();
        this.hideError();
      } else {
        this.showError(data.message || 'Invalid admin password');
      }
    } catch (error) {
      console.error('Authentication error:', error);
      this.showError('Authentication failed. Please try again.');
    } finally {
      submitButton.textContent = originalText;
      submitButton.disabled = false;
    }
  }

  private async handleLogout(): Promise<void> {
    if (!confirm('Are you sure you want to logout?')) return;

    try {
      const response = await fetch('/admin/logout', {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        this.isAuthenticated = false;
        this.showAuthForm();
        // Clear the password field
        const passwordInput = document.getElementById('admin-password') as HTMLInputElement;
        if (passwordInput) passwordInput.value = '';
      } else {
        this.showError('Logout failed');
      }
    } catch (error) {
      console.error('Logout error:', error);
      this.showError('Logout failed');
    }
  }

  private handleSearch(e: Event): void {
    const input = e.target as HTMLInputElement;
    this.currentFilter = input.value;
    this.filterOrders();
  }

  private handleTabChange(e: Event): void {
    const button = e.target as HTMLButtonElement;
    const tabName = button.id.replace('-btn', '');
    
    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active', 'bg-violet-500');
      btn.classList.add('bg-gray-600');
    });
    
    button.classList.add('active', 'bg-violet-500');
    button.classList.remove('bg-gray-600');

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });

    if (tabName === 'users') {
      this.currentTab = 'users';
      document.getElementById('users-section')?.classList.remove('hidden');
      this.loadUsers();
    } else {
      this.currentTab = tabName.replace('-orders', '') || 'all';
      document.getElementById('orders-section')?.classList.remove('hidden');
      this.loadOrders();
    }
  }

  private showAuthForm(): void {
    document.getElementById('auth-container')?.classList.remove('hidden');
    document.getElementById('admin-panel')?.classList.add('hidden');
  }

  private showAdminPanel(): void {
    document.getElementById('auth-container')?.classList.add('hidden');
    document.getElementById('admin-panel')?.classList.remove('hidden');
  }

  private showError(message: string): void {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      errorDiv.textContent = message;
      errorDiv.classList.remove('hidden');
    }
  }

  private hideError(): void {
    const errorDiv = document.getElementById('error-message');
    if (errorDiv) {
      errorDiv.classList.add('hidden');
    }
  }

  private async loadOrders(): Promise<void> {
    if (!this.isAuthenticated) {
      this.showAuthForm();
      return;
    }

    try {
      const loadingDiv = document.getElementById('orders-loading');
      const listDiv = document.getElementById('orders-list');
      
      if (loadingDiv) loadingDiv.classList.remove('hidden');
      if (listDiv) listDiv.classList.add('hidden');

      const response = await fetch('/admin/orders');
      
      if (response.status === 401) {
        this.isAuthenticated = false;
        this.showAuthForm();
        return;
      }

      const data = await response.json();

      if (data.success) {
        this.displayOrders(data.orders);
      } else {
        this.showError('Failed to load orders');
      }
    } catch (error) {
      console.error('Error loading orders:', error);
      this.showError('Error loading orders');
    }
  }

  private async loadUsers(): Promise<void> {
    if (!this.isAuthenticated) {
      this.showAuthForm();
      return;
    }

    try {
      const loadingDiv = document.getElementById('users-loading');
      const listDiv = document.getElementById('users-list');
      
      if (loadingDiv) loadingDiv.classList.remove('hidden');
      if (listDiv) listDiv.classList.add('hidden');

      const response = await fetch('/admin/users');
      
      if (response.status === 401) {
        this.isAuthenticated = false;
        this.showAuthForm();
        return;
      }

      const data = await response.json();

      if (data.success) {
        this.displayUsers(data.users);
      } else {
        this.showError('Failed to load users');
      }
    } catch (error) {
      console.error('Error loading users:', error);
      this.showError('Error loading users');
    }
  }

  private displayOrders(orders: Order[]): void {
    const loadingDiv = document.getElementById('orders-loading');
    const listDiv = document.getElementById('orders-list');
    
    if (loadingDiv) loadingDiv.classList.add('hidden');
    if (listDiv) {
      listDiv.classList.remove('hidden');
      listDiv.innerHTML = '';

      const filteredOrders = this.filterOrdersByTab(orders);
      
      if (filteredOrders.length === 0) {
        listDiv.innerHTML = '<p class="text-gray-400 text-center py-8">No orders found</p>';
        return;
      }

      filteredOrders.forEach(order => {
        const orderElement = this.createOrderElement(order);
        listDiv.appendChild(orderElement);
      });
    }
  }

  private displayUsers(users: User[]): void {
    const loadingDiv = document.getElementById('users-loading');
    const listDiv = document.getElementById('users-list');
    
    if (loadingDiv) loadingDiv.classList.add('hidden');
    if (listDiv) {
      listDiv.classList.remove('hidden');
      listDiv.innerHTML = '';

      if (users.length === 0) {
        listDiv.innerHTML = '<p class="text-gray-400 text-center py-8">No users found</p>';
        return;
      }

      users.forEach(user => {
        const userElement = this.createUserElement(user);
        listDiv.appendChild(userElement);
      });
    }
  }

  private filterOrdersByTab(orders: Order[]): Order[] {
    let filtered = orders;
    
    if (this.currentTab === 'pending') {
      filtered = orders.filter(order => order.status === 'pending');
    } else if (this.currentTab === 'confirmed') {
      filtered = orders.filter(order => order.status === 'confirmed');
    }

    if (this.currentFilter) {
      const filter = this.currentFilter.toLowerCase();
      
      if (filter.startsWith('user_id:')) {
        const userId = filter.replace('user_id:', '');
        filtered = filtered.filter(order => order.user_id.toString() === userId);
      } else {
        filtered = filtered.filter(order => 
          order.username.toLowerCase().includes(filter) ||
          order.description.toLowerCase().includes(filter) ||
          order.id.toString().includes(filter)
        );
      }
    }

    return filtered;
  }

  private filterOrders(): void {
    this.loadOrders();
  }

  private createOrderElement(order: Order): HTMLElement {
    const orderDiv = document.createElement('div');
    orderDiv.className = 'bg-gray-700 rounded-lg p-6';
    
    const statusColor = this.getStatusColor(order.status);
    const formattedDate = new Date(order.created_at).toLocaleDateString();
    
    orderDiv.innerHTML = `
      <div class="flex justify-between items-start mb-4">
        <div>
          <h3 class="text-xl font-semibold text-white">Order #${order.id}</h3>
          <p class="text-gray-300">by ${order.username}</p>
        </div>
        <span class="px-3 py-1 rounded-full text-sm font-medium ${statusColor}">
          ${order.status.toUpperCase()}
        </span>
      </div>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <p class="text-gray-400 text-sm">Description:</p>
          <p class="text-white">${order.description}</p>
        </div>
        <div>
          <p class="text-gray-400 text-sm">Amount:</p>
          <p class="text-white">$${order.amount}</p>
        </div>
        <div>
          <p class="text-gray-400 text-sm">Delivery Time:</p>
          <p class="text-white">${order.delivery_time}</p>
        </div>
        <div>
          <p class="text-gray-400 text-sm">Created:</p>
          <p class="text-white">${formattedDate}</p>
        </div>
      </div>
      
      <div class="flex gap-2 mt-4">
        ${order.status === 'pending' ? `
          <button class="confirm-btn bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors" data-id="${order.id}">
            Confirm Order
          </button>
        ` : ''}
        ${order.status === 'confirmed' ? `
          <button class="complete-btn bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors" data-id="${order.id}">
            Mark Complete
          </button>
        ` : ''}
        <button class="delete-btn bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors" data-id="${order.id}">
          Delete Order
        </button>
      </div>
    `;

    this.bindOrderActions(orderDiv, order.id);
    return orderDiv;
  }

  private createUserElement(user: User): HTMLElement {
    const userDiv = document.createElement('div');
    userDiv.className = 'bg-gray-700 rounded-lg p-6';
    
    const formattedDate = new Date(user.created_at).toLocaleDateString();
    
    userDiv.innerHTML = `
      <div class="flex items-center gap-4 mb-4">
        <img src="${user.profile_image_url}" alt="${user.username}" class="w-16 h-16 rounded-full object-cover">
        <div>
          <h3 class="text-xl font-semibold text-white">${user.username}</h3>
          <p class="text-gray-400">User ID: ${user.id}</p>
          <p class="text-gray-400">Joined: ${formattedDate}</p>
        </div>
      </div>
      
      <div class="flex gap-2">
        <button class="view-user-orders-btn bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-lg transition-colors" data-id="${user.id}">
          View Orders
        </button>
        <button class="delete-user-btn bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors" data-id="${user.id}">
          Delete User
        </button>
      </div>
    `;

    this.bindUserActions(userDiv, user.id);
    return userDiv;
  }

  private bindOrderActions(element: HTMLElement, orderId: number): void {
    const confirmBtn = element.querySelector('.confirm-btn');
    const completeBtn = element.querySelector('.complete-btn');
    const deleteBtn = element.querySelector('.delete-btn');

    confirmBtn?.addEventListener('click', () => this.confirmOrder(orderId));
    completeBtn?.addEventListener('click', () => this.completeOrder(orderId));
    deleteBtn?.addEventListener('click', () => this.deleteOrder(orderId));
  }

  private bindUserActions(element: HTMLElement, userId: number): void {
    const viewOrdersBtn = element.querySelector('.view-user-orders-btn');
    const deleteUserBtn = element.querySelector('.delete-user-btn');

    viewOrdersBtn?.addEventListener('click', () => this.viewUserOrders(userId));
    deleteUserBtn?.addEventListener('click', () => this.deleteUser(userId));
  }

  private async confirmOrder(orderId: number): Promise<void> {
    if (!confirm('Are you sure you want to confirm this order?')) return;

    try {
      const response = await fetch(`/admin/orders/${orderId}/confirm`, {
        method: 'POST'
      });

      if (response.status === 401) {
        this.isAuthenticated = false;
        this.showAuthForm();
        return;
      }

      const data = await response.json();

      if (data.success) {
        this.loadOrders();
      } else {
        this.showError('Failed to confirm order');
      }
    } catch (error) {
      this.showError('Error confirming order');
    }
  }

  private async completeOrder(orderId: number): Promise<void> {
    if (!confirm('Are you sure you want to mark this order as complete?')) return;

    try {
      const response = await fetch(`/admin/orders/${orderId}/complete`, {
        method: 'POST'
      });

      if (response.status === 401) {
        this.isAuthenticated = false;
        this.showAuthForm();
        return;
      }

      const data = await response.json();

      if (data.success) {
        this.loadOrders();
      } else {
        this.showError('Failed to complete order');
      }
    } catch (error) {
      this.showError('Error completing order');
    }
  }

  private async deleteOrder(orderId: number): Promise<void> {
    if (!confirm('Are you sure you want to delete this order? This action cannot be undone.')) return;

    try {
      const response = await fetch(`/admin/orders/${orderId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        this.loadOrders();
      } else {
        this.showError('Failed to delete order');
      }
    } catch (error) {
      this.showError('Error deleting order');
    }
  }

  private async deleteUser(userId: number): Promise<void> {
    if (!confirm('Are you sure you want to delete this user? This will also delete all their orders and cannot be undone.')) return;

    try {
      const response = await fetch(`/admin/users/${userId}`, {
        method: 'DELETE'
      });
      const data = await response.json();

      if (data.success) {
        this.loadUsers();
      } else {
        this.showError('Failed to delete user');
      }
    } catch (error) {
      this.showError('Error deleting user');
    }
  }

  private viewUserOrders(userId: number): void {
    const searchInput = document.getElementById('search-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.value = `user_id:${userId}`;
      this.currentFilter = searchInput.value;
    }

    document.querySelectorAll('.tab-button').forEach(btn => {
      btn.classList.remove('active', 'bg-violet-500');
      btn.classList.add('bg-gray-600');
    });
    
    const allOrdersBtn = document.getElementById('all-orders-btn');
    if (allOrdersBtn) {
      allOrdersBtn.classList.add('active', 'bg-violet-500');
      allOrdersBtn.classList.remove('bg-gray-600');
    }

    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.add('hidden');
    });
    
    document.getElementById('orders-section')?.classList.remove('hidden');
    this.currentTab = 'all';
    this.loadOrders();
  }

  private getStatusColor(status: string): string {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500 text-yellow-100';
      case 'confirmed':
        return 'bg-green-500 text-green-100';
      case 'completed':
        return 'bg-blue-500 text-blue-100';
      case 'cancelled':
        return 'bg-red-500 text-red-100';
      default:
        return 'bg-gray-500 text-gray-100';
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AdminPanel();
});
