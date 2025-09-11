
interface User {
    id: number;
    username: string;
    profile_image_url?: string;
    shipping_address?: string;
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
    discount_code_id?: number | null;
    discount_applied?: number;
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

        const shippingAddressElement = document.getElementById('shipping-address');
        if (shippingAddressElement) {
            shippingAddressElement.textContent = this.currentUser.shipping_address || 'No delivery address set';
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

    private renderOrders(orders: Order[]): string {
        if (!orders.length) {
            return `<div class="text-center text-gray-400 py-8">No orders found.</div>`;
        }
        return orders.map(order => {
            const discount = order.discount_applied && order.discount_applied > 0 ? `<div class='text-green-400'>Discount applied: -£${order.discount_applied.toFixed(2)}</div>` : '';
            return `
                <div class="order-card bg-gray-700 rounded-lg p-6 mb-4">
                    <div class="flex justify-between items-center mb-2">
                        <div>
                            <span class="font-semibold text-white">Order #${order.id}</span>
                            <span class="ml-2 text-gray-400 text-xs">${new Date(order.created_at).toLocaleDateString()}</span>
                        </div>
                        <span class="px-3 py-1 rounded-full text-sm font-medium ${this.getStatusColor(order.status)}">
                            ${order.status.toUpperCase()}
                        </span>
                    </div>
                    <div class="text-white mb-2">${order.model_name} (${order.plastic}, ${order.weight}g)</div>
                    <div class="text-gray-300 mb-2">Delivery: ${order.delivery}</div>
                    <div class="text-gray-300 mb-2">Price: £${order.price.toFixed(2)}</div>
                    ${discount}
                </div>
            `;
        }).join('');
    }

    private getStatusColor(status: string): string {
        switch (status) {
            case 'pending': return 'bg-yellow-500 text-yellow-100';
            case 'confirmed': return 'bg-green-500 text-green-100';
            case 'completed': return 'bg-blue-500 text-blue-100';
            case 'cancelled': return 'bg-red-500 text-red-100';
            default: return 'bg-gray-500 text-gray-100';
        }
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

    // Removed old renderOrders, replaced by new version above supporting discount display

}

document.addEventListener('DOMContentLoaded', () => {

    new AccountPage();
});
