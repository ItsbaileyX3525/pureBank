interface Order {
  id: number;
  user_id: number;
  username: string;
  description: string;
  amount: number;
  delivery_time: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  created_at: string;
  discount_code_id?: number | null;
  discount_applied?: number;
}

interface User {
  id: number;
  username: string;
  profile_image_url: string;
  shipping_address?: string;
  created_at: string;
  email?: string;
  phone?: string;
  balance?: number;
}

class AdminPanel {
  private bindAdminOrderForm(): void {
    const form = document.getElementById('admin-create-order-form') as HTMLFormElement;
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const model = (document.getElementById('admin-order-model') as HTMLInputElement).value.trim();
      const plastic = (document.getElementById('admin-order-plastic') as HTMLInputElement).value.trim();
      const weight = parseInt((document.getElementById('admin-order-weight') as HTMLInputElement).value);
      const delivery = (document.getElementById('admin-order-delivery') as HTMLInputElement).value.trim();
      const shipping_location = (document.getElementById('admin-order-shipping-location') as HTMLInputElement).value.trim();
      const amount = parseFloat((document.getElementById('admin-order-amount') as HTMLInputElement).value);
      const description = (document.getElementById('admin-order-description') as HTMLInputElement).value.trim();
      if (!model || !plastic || isNaN(weight) || !delivery || !shipping_location || isNaN(amount)) {
        this.showError('Please fill in all required fields.');
        return;
      }
      const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Creating...';
      try {
        const res = await fetch('/admin/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: 1, // Admin user (or set to a special admin user id)
            model_name: model,
            plastic,
            weight,
            delivery,
            shipping_location,
            price: amount,
            amount,
            fulfilled: false,
            description: description || `Admin created order: ${model}`,
            delivery_time: delivery,
            status: 'pending',
            discount_code: null
          })
        });
        const data = await res.json();
        if (data.success) {
          form.reset();
          this.loadOrders();
        } else {
          this.showError(data.error || 'Failed to create order');
        }
      } catch (err) {
        this.showError('Error creating order');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }
  private currentTab = 'all';
  private currentFilter = '';
  private isAuthenticated = false;

  constructor() {
  this.init();
  }

  private async init(): Promise<void> {
  await this.checkAuthStatus();
  this.bindEvents();
  this.bindAdminOrderForm();
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
    const discountsBtn = document.getElementById('discounts-btn');

    authForm?.addEventListener('submit', this.handleAuth.bind(this));
    logoutBtn?.addEventListener('click', this.handleLogout.bind(this));
    searchInput?.addEventListener('input', this.handleSearch.bind(this));

    tabButtons.forEach(btn => {
      btn.addEventListener('click', this.handleTabChange.bind(this));
    });

    // Discount tab logic
    if (discountsBtn) {
      discountsBtn.addEventListener('click', () => {
        this.currentTab = 'discounts';
        document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
        document.getElementById('discounts-section')?.classList.remove('hidden');
        this.loadDiscounts();
      });
    }

    const discountForm = document.getElementById('discount-form') as HTMLFormElement;
    if (discountForm) {
      discountForm.addEventListener('submit', this.handleDiscountForm.bind(this));
    }
  }

  private async loadDiscounts(): Promise<void> {
    const listDiv = document.getElementById('discounts-list');
    if (!listDiv) return;
    listDiv.innerHTML = '<div class="text-gray-400">Loading...</div>';
    try {
      const res = await fetch('/admin/discounts');
      const data = await res.json();
      if (data.success) {
        listDiv.innerHTML = '';
        if (!data.discounts.length) {
          listDiv.innerHTML = '<div class="text-gray-400">No discounts found.</div>';
        } else {
          data.discounts.forEach((d: any) => {
            const div = document.createElement('div');
            div.className = 'bg-gray-800 rounded p-3 flex justify-between items-center';
            div.innerHTML = `
              <div>
                <span class="font-bold text-white">${d.code}</span>
                <span class="ml-2 text-gray-400">${d.description || ''}</span>
                <span class="ml-2 text-violet-400">${d.discount_type === 'percent' ? d.discount_value + '%' : '£' + d.discount_value}</span>
                <span class="ml-2 text-blue-400">Uses: ${d.uses ?? 0}/${d.max_uses === -1 ? '∞' : d.max_uses}</span>
                ${d.active ? '<span class="ml-2 text-green-400">Active</span>' : '<span class="ml-2 text-red-400">Inactive</span>'}
                ${d.expires_at ? `<span class="ml-2 text-yellow-400">Expires: ${new Date(d.expires_at).toLocaleString()}</span>` : ''}
              </div>
              <button class="delete-discount-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded cursor-pointer" data-id="${d.id}">Delete</button>
            `;
            div.querySelector('.delete-discount-btn')?.addEventListener('click', () => this.deleteDiscount(d.id));
            listDiv.appendChild(div);
          });
        }
      } else {
        listDiv.innerHTML = '<div class="text-red-400">Failed to load discounts.</div>';
      }
    } catch (e) {
      listDiv.innerHTML = '<div class="text-red-400">Error loading discounts.</div>';
    }
  }

  private async handleDiscountForm(e: Event): Promise<void> {
    e.preventDefault();
    const code = (document.getElementById('discount-code') as HTMLInputElement).value.trim();
    const description = (document.getElementById('discount-desc') as HTMLInputElement).value.trim();
    const discount_type = (document.getElementById('discount-type') as HTMLSelectElement).value;
    const discount_value = parseFloat((document.getElementById('discount-value') as HTMLInputElement).value);
    const max_uses = parseInt((document.getElementById('discount-max-uses') as HTMLInputElement).value);
    const expires_at = (document.getElementById('discount-expires') as HTMLInputElement).value || null;
    const active = (document.getElementById('discount-active') as HTMLInputElement).checked;
    if (!code || !discount_type || isNaN(discount_value) || isNaN(max_uses)) {
      alert('Please fill in all required fields.');
      return;
    }
    try {
      const res = await fetch('/admin/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, description, discount_type, discount_value, active, expires_at, max_uses })
      });
      const data = await res.json();
      if (data.success) {
        (e.target as HTMLFormElement).reset();
        this.loadDiscounts();
      } else {
        alert(data.error || 'Failed to create discount');
      }
    } catch (err) {
      alert('Error creating discount');
    }
  }

  private async deleteDiscount(id: number): Promise<void> {
    if (!confirm('Delete this discount code?')) return;
    try {
      const res = await fetch(`/admin/discounts/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        this.loadDiscounts();
      } else {
        alert('Failed to delete discount');
      }
    } catch (e) {
      alert('Error deleting discount');
    }
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
    const discount = order.discount_applied && order.discount_applied > 0 ? `<div class='text-green-400'>Discount applied: -£${order.discount_applied.toFixed(2)}</div>` : '';
    
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
          <div class="flex items-center gap-2">
            <input type="number" step="0.01" min="0" value="${order.amount}" class="order-amount-input bg-gray-800 text-white px-2 py-1 rounded w-24" data-id="${order.id}" />
            <button class="update-amount-btn bg-yellow-500 hover:bg-yellow-600 text-white px-2 py-1 rounded cursor-pointer" data-id="${order.id}">Update</button>
          </div>
              <div class="flex items-center gap-2">
                <input type="number" step="0.01" min="0" value="${order.discount_applied ?? 0}" class="order-discount-input bg-gray-800 text-green-300 px-2 py-1 rounded w-24" data-id="${order.id}" />
                <button class="update-discount-btn bg-green-500 hover:bg-green-600 text-white px-2 py-1 rounded cursor-pointer" data-id="${order.id}">Update Discount</button>
              </div>
          ${discount}
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
        <button class="view-account-btn bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer" data-user-id="${order.user_id}">
          View User Account
        </button>
        ${order.status === 'pending' ? `
          <button class="confirm-btn bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer" data-id="${order.id}">
            Confirm Order
          </button>
        ` : ''}
        ${order.status === 'confirmed' ? `
          <button class="complete-btn bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer" data-id="${order.id}">
            Mark Complete
          </button>
        ` : ''}
        <button class="delete-btn bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer" data-id="${order.id}">
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
          <p class="text-gray-400">Delivery Address: ${user.shipping_address || 'Not set'}</p>
        </div>
      </div>
      
      <div class="flex gap-2">
        <button class="view-account-details-btn bg-purple-500 hover:bg-purple-600 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer" data-id="${user.id}">
          View Account Details
        </button>
        <button class="view-user-orders-btn bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer" data-id="${user.id}">
          View Orders
        </button>
        <button class="delete-user-btn bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer" data-id="${user.id}">
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
    const viewAccountBtn = element.querySelector('.view-account-btn');
    const updateAmountBtn = element.querySelector('.update-amount-btn') as HTMLButtonElement;
    const amountInput = element.querySelector('.order-amount-input') as HTMLInputElement;
        const updateDiscountBtn = element.querySelector('.update-discount-btn') as HTMLButtonElement;
        const discountInput = element.querySelector('.order-discount-input') as HTMLInputElement;

    confirmBtn?.addEventListener('click', () => this.confirmOrder(orderId));
    completeBtn?.addEventListener('click', () => this.completeOrder(orderId));
    deleteBtn?.addEventListener('click', () => this.deleteOrder(orderId));
    
    viewAccountBtn?.addEventListener('click', () => {
      const userId = parseInt(viewAccountBtn.getAttribute('data-user-id') || '0');
      if (userId > 0) {
        this.viewUserAccount(userId);
      }
    });

    updateAmountBtn?.addEventListener('click', () => {
      if (!amountInput) return;
      const newAmount = parseFloat(amountInput.value);
      if (isNaN(newAmount) || newAmount < 0) {
        this.showError('Please enter a valid amount.');
        return;
      }
      this.updateOrderAmount(orderId, newAmount, updateAmountBtn);
    });
        updateDiscountBtn?.addEventListener('click', async () => {
          if (!discountInput) return;
          const newDiscount = parseFloat(discountInput.value);
          if (isNaN(newDiscount) || newDiscount < 0) {
            alert('Please enter a valid discount amount (0 or greater).');
            return;
          }
          updateDiscountBtn.disabled = true;
          const originalText = updateDiscountBtn.textContent;
          updateDiscountBtn.textContent = 'Updating...';
          try {
            const res = await fetch(`/admin/order/${orderId}/discount`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ discount_applied: newDiscount })
            });
            const data = await res.json();
            if (data.success) {
              updateDiscountBtn.textContent = 'Updated!';
              setTimeout(() => {
                updateDiscountBtn.textContent = originalText;
              }, 1200);
            } else {
              alert(data.error || 'Failed to update discount.');
              updateDiscountBtn.textContent = originalText;
            }
          } catch (e) {
            alert('Network error updating discount.');
            updateDiscountBtn.textContent = originalText;
          } finally {
            updateDiscountBtn.disabled = false;
          }
        });
  }

  private async updateOrderAmount(orderId: number, newAmount: number, btn: HTMLButtonElement): Promise<void> {
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = 'Updating...';
    try {
      const response = await fetch(`/admin/orders/${orderId}/amount`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: newAmount })
      });
      const data = await response.json();
      if (data.success) {
        this.loadOrders();
      } else {
        this.showError(data.error || 'Failed to update amount');
      }
    } catch (error) {
      this.showError('Error updating amount');
    } finally {
      btn.disabled = false;
      btn.textContent = originalText;
    }
  }

  private bindUserActions(element: HTMLElement, userId: number): void {
    const viewAccountDetailsBtn = element.querySelector('.view-account-details-btn');
    const viewOrdersBtn = element.querySelector('.view-user-orders-btn');
    const deleteUserBtn = element.querySelector('.delete-user-btn');

    viewAccountDetailsBtn?.addEventListener('click', () => this.viewUserAccount(userId));
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

  private async viewUserAccount(userId: number): Promise<void> {
    try {
      const response = await fetch(`/admin/users/${userId}/details`);
      
      if (response.status === 401) {
        this.isAuthenticated = false;
        this.showAuthForm();
        return;
      }

      const data = await response.json();

      if (data.success) {
        this.displayUserAccountModal(data.user);
      } else {
        this.showError('Failed to load user account details');
      }
    } catch (error) {
      console.error('Error loading user account:', error);
      this.showError('Error loading user account details');
    }
  }

  private displayUserAccountModal(user: User): void {
    // Create modal overlay
    const modalOverlay = document.createElement('div');
    modalOverlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4';
    modalOverlay.id = 'user-account-modal';

    const formattedDate = new Date(user.created_at).toLocaleDateString();
    const formattedBalance = user.balance ? `£${user.balance.toFixed(2)}` : 'N/A';

    modalOverlay.innerHTML = `
      <div class="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div class="flex justify-between items-center mb-6">
          <h2 class="text-2xl font-bold text-white">User Account Details</h2>
          <button class="close-modal-btn text-gray-400 hover:text-white text-2xl">&times;</button>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div class="flex items-center gap-4 md:col-span-2">
            <img src="${user.profile_image_url}" alt="${user.username}" class="w-20 h-20 rounded-full object-cover">
            <div>
              <h3 class="text-xl font-semibold text-white">${user.username}</h3>
              <p class="text-gray-400">User ID: ${user.id}</p>
            </div>
          </div>
          
          <div>
            <h4 class="text-lg font-semibold text-white mb-3">Personal Information</h4>
            <div class="space-y-2">
              <div>
                <p class="text-gray-400 text-sm">Email:</p>
                <p class="text-white">${user.email || 'Not provided'}</p>
              </div>
              <div>
                <p class="text-gray-400 text-sm">Phone:</p>
                <p class="text-white">${user.phone || 'Not provided'}</p>
              </div>
              <div>
                <p class="text-gray-400 text-sm">Account Balance:</p>
                <p class="text-white font-semibold ${user.balance && user.balance > 0 ? 'text-green-400' : ''}">${formattedBalance}</p>
              </div>
              <div>
                <p class="text-gray-400 text-sm">Member Since:</p>
                <p class="text-white">${formattedDate}</p>
              </div>
            </div>
          </div>
          
          <div>
            <h4 class="text-lg font-semibold text-white mb-3">Delivery Information</h4>
            <div>
              <p class="text-gray-400 text-sm">Shipping Address:</p>
              <p class="text-white">${user.shipping_address || 'No address provided'}</p>
            </div>
          </div>
        </div>
        
        <div class="mt-6 flex gap-3">
          <button class="view-user-orders-from-modal-btn bg-violet-500 hover:bg-violet-600 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer" data-id="${user.id}">
            View All Orders
          </button>
          <button class="edit-user-btn bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer" data-id="${user.id}">
            Edit Account
          </button>
          <button class="close-modal-btn bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors cursor-pointer">
            Close
          </button>
        </div>
      </div>
    `;

    // Add event listeners
    const closeButtons = modalOverlay.querySelectorAll('.close-modal-btn');
    closeButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        modalOverlay.remove();
      });
    });

    const viewOrdersBtn = modalOverlay.querySelector('.view-user-orders-from-modal-btn');
    viewOrdersBtn?.addEventListener('click', () => {
      modalOverlay.remove();
      this.viewUserOrders(user.id);
    });

    const editUserBtn = modalOverlay.querySelector('.edit-user-btn');
    editUserBtn?.addEventListener('click', () => {
      modalOverlay.remove();
      this.editUserAccount(user.id);
    });

    // Close modal when clicking outside
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        modalOverlay.remove();
      }
    });

    document.body.appendChild(modalOverlay);
  }

  private async editUserAccount(userId: number): Promise<void> {
    // This method can be expanded to show an edit form
    // For now, we'll just show an alert
    alert(`User account editing feature coming soon for user ID: ${userId}!`);
    // TODO: Implement user account editing functionality
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
