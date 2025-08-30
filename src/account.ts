interface User {
    id: number;
    username: string;
    profile_image_url?: string;
    created_at?: string;
}

interface Order {
    id: number;
    user_id: number;
    model_name: string;
    plastic: string;
    weight: number;
    delivery: string;
    price: number;
    fulfilled: boolean;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    created_at: string;
}

class AccountPage {
    private currentUser: User | null = null;
    private orders: Order[] = [];

    constructor() {
        this.init();
    }

    private async init() {
        this.setupTabs();
        this.setupLogout();
        this.showInitialLoadingState();
        await this.loadUserDataAndOrders();
    }

    private async loadUserDataAndOrders() {
        const userId = localStorage.getItem('userId');
        const username = localStorage.getItem('username');
        
        if (!userId || !username) {
            window.location.href = '/signup.html';
            return;
        }
        
        await this.fetchUserProfile(parseInt(userId));
        await this.loadOrders();
    }

    private showInitialLoadingState() {
        const container = document.getElementById('all-orders');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-8 text-gray-400">
                    <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400 mx-auto mb-4"></div>
                    Loading orders...
                </div>
            `;
        }
    }

    private setupLogout() {
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('userId');
                localStorage.removeItem('username');
                
                window.location.href = '/signup.html';
            });
        }
    }

    private setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => {
                    btn.classList.remove('active', 'border-violet-400', 'text-violet-400');
                    btn.classList.add('border-transparent', 'text-gray-400');
                });

                button.classList.add('active', 'border-violet-400', 'text-violet-400');
                button.classList.remove('border-transparent', 'text-gray-400');

                tabContents.forEach(content => content.classList.add('hidden'));

                const tabId = button.id.replace('tab-', '');
                const targetContent = document.getElementById(`${tabId}-content`);
                if (targetContent) {
                    targetContent.classList.remove('hidden');
                }

                this.loadTabContent(tabId);
            });
        });
    }

    private async fetchUserProfile(userId: number) {
        try {
            const response = await fetch(`/api/user/${userId}`);
            const data = await response.json();
            
            if (data.success && data.user) {
                this.currentUser = data.user;
                this.updateUserDisplay();
            } else {
                const username = localStorage.getItem('username');
                this.currentUser = { 
                    id: userId, 
                    username: username || "User",
                    profile_image_url: "/assets/man.jpg"
                };
                this.updateUserDisplay();
            }
        } catch (error) {
            console.error('Error fetching user profile:', error);
            const username = localStorage.getItem('username');
            this.currentUser = { 
                id: userId, 
                username: username || "User",
                profile_image_url: "/assets/man.jpg"
            };
            this.updateUserDisplay();
        }
    }

    private updateUserDisplay() {
        if (!this.currentUser) return;

        const usernameElement = document.getElementById('username');
        if (usernameElement) {
            usernameElement.textContent = this.currentUser.username;
        }

        const profileImageElement = document.getElementById('profile-image') as HTMLImageElement;
        if (profileImageElement && this.currentUser.profile_image_url) {
            profileImageElement.src = this.currentUser.profile_image_url;
            profileImageElement.alt = `${this.currentUser.username}'s profile picture`;
        }

        const memberSinceElement = document.getElementById('member-since');
        if (memberSinceElement && this.currentUser.created_at) {
            const createdDate = new Date(this.currentUser.created_at);
            memberSinceElement.textContent = createdDate.getFullYear().toString();
        }
    }

    private async loadOrders() {
        if (!this.currentUser) return;

        try {
            const response = await fetch(`/api/user/${this.currentUser.id}/orders`);
            const data = await response.json();
            
            if (data.success) {
                this.orders = data.orders || [];
            } else {
                this.orders = [];
            }
            
            const totalOrdersElement = document.getElementById('total-orders');
            if (totalOrdersElement) {
                totalOrdersElement.textContent = this.orders.length.toString();
            }

            this.loadTabContent('orders');
        } catch (error) {
            console.error('Error loading orders:', error);
            this.orders = [];
            this.loadTabContent('orders');
        }
    }

    private async loadTabContent(tabId: string) {
        if (!this.currentUser) return;

        try {
            switch (tabId) {
                case 'orders':
                    await this.displayAllOrders();
                    break;
                case 'active':
                    await this.displayActiveOrders();
                    break;
                case 'completed':
                    await this.displayCompletedOrders();
                    break;
            }
        } catch (error) {
            console.error('Error loading tab content:', error);
        }
    }

    private async displayAllOrders() {
        const container = document.getElementById('all-orders');
        if (!container) return;

        container.innerHTML = this.renderOrders(this.orders);
    }

    private async displayActiveOrders() {
        const container = document.getElementById('active-orders');
        if (!container) return;

        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400 mx-auto mb-4"></div>
                Loading active orders...
            </div>
        `;

        try {
            const response = await fetch(`/api/user/${this.currentUser!.id}/orders/active`);
            const data = await response.json();
            
            let activeOrders: Order[] = [];
            if (data.success && data.orders) {
                activeOrders = data.orders;
            } else {
                // Use status for filtering instead of fulfilled
                activeOrders = this.orders.filter(order => order.status === 'pending' || order.status === 'confirmed');
            }
            
            container.innerHTML = this.renderOrders(activeOrders);
        } catch (error) {
            console.error('Error fetching active orders:', error);
            // Use status for filtering instead of fulfilled
            const activeOrders = this.orders.filter(order => order.status === 'pending' || order.status === 'confirmed');
            container.innerHTML = this.renderOrders(activeOrders);
        }
    }

    private async displayCompletedOrders() {
        const container = document.getElementById('completed-orders');
        if (!container) return;

        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-violet-400 mx-auto mb-4"></div>
                Loading completed orders...
            </div>
        `;

        try {
            const response = await fetch(`/api/user/${this.currentUser!.id}/orders/completed`);
            const data = await response.json();
            
            let completedOrders: Order[] = [];
            if (data.success && data.orders) {
                completedOrders = data.orders;
            } else {
                // Use status for filtering instead of fulfilled
                completedOrders = this.orders.filter(order => order.status === 'completed');
            }
            
            container.innerHTML = this.renderOrders(completedOrders);
        } catch (error) {
            console.error('Error fetching completed orders:', error);
            // Use status for filtering instead of fulfilled
            const completedOrders = this.orders.filter(order => order.status === 'completed');
            container.innerHTML = this.renderOrders(completedOrders);
        }
    }

    private renderOrders(orders: Order[]): string {
        if (orders.length === 0) {
            return `
                <div class="text-center py-12 text-gray-400">
                    <div class="text-6xl mb-4">📦</div>
                    <h3 class="text-xl font-semibold text-white mb-2">No orders yet</h3>
                    <p class="mb-6">You haven't placed any 3D printing orders yet.</p>
                    <a href="/shop.html" class="bg-violet-500 hover:bg-violet-600 text-white px-6 py-3 rounded-lg font-medium transition-colors inline-block">
                        Create Your First Order
                    </a>
                </div>
            `;
        }

        return orders.map(order => this.renderOrderCard(order)).join('');
    }

    private renderOrderCard(order: Order): string {
        // Use status instead of fulfilled for status badge
        let statusBadge = '';
        if (order.status === 'completed') {
            statusBadge = '<span class="bg-green-500 text-green-100 px-2 py-1 rounded-full text-xs font-medium">Completed</span>';
        } else if (order.status === 'confirmed') {
            statusBadge = '<span class="bg-blue-500 text-blue-100 px-2 py-1 rounded-full text-xs font-medium">Confirmed</span>';
        } else {
            statusBadge = '<span class="bg-yellow-500 text-yellow-100 px-2 py-1 rounded-full text-xs font-medium">Pending</span>';
        }

        const formattedDate = new Date(order.created_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        // Handle all delivery types
        let deliveryLabel = '';
        if (order.delivery === 'fast') deliveryLabel = 'Fast';
        else if (order.delivery === 'express') deliveryLabel = 'Express';
        else deliveryLabel = 'Standard';

        // Use status for border color
        let borderColor = '';
        if (order.status === 'completed') borderColor = 'border-green-500';
        else if (order.status === 'confirmed') borderColor = 'border-blue-500';
        else borderColor = 'border-yellow-500';

        return `
            <div class="order-card bg-gray-700 rounded-lg p-4 border-l-4 ${borderColor} hover:bg-gray-600 transition-all duration-200">
                <div class="flex justify-between items-start mb-3">
                    <div>
                        <h3 class="text-lg font-semibold text-white">${order.model_name}</h3>
                        <p class="text-gray-400 text-sm">Order #${order.id}</p>
                    </div>
                    ${statusBadge}
                </div>
                
                <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                        <span class="text-gray-400">Material:</span>
                        <p class="text-white font-medium">${order.plastic.toUpperCase()}</p>
                    </div>
                    <div>
                        <span class="text-gray-400">Weight:</span>
                        <p class="text-white font-medium">${order.weight}g</p>
                    </div>
                    <div>
                        <span class="text-gray-400">Delivery:</span>
                        <p class="text-white font-medium">${deliveryLabel}</p>
                    </div>
                    <div>
                        <span class="text-gray-400">Price:</span>
                        <p class="text-white font-medium">£${order.price.toFixed(2)}</p>
                    </div>
                </div>
                
                <div class="mt-3 pt-3 border-t border-gray-600 flex justify-between items-center">
                    <span class="text-gray-400 text-sm">Ordered on ${formattedDate}</span>
                    <button class="text-violet-400 hover:text-violet-300 text-sm font-medium transition-colors">
                        View Details
                    </button>
                </div>
            </div>
        `;
    }

}

document.addEventListener('DOMContentLoaded', () => {
    new AccountPage();
});
