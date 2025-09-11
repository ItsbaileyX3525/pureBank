class SignupPage {
    private form: HTMLFormElement;
    private usernameInput: HTMLInputElement;
    private passwordInput: HTMLInputElement;
    private confirmPasswordInput: HTMLInputElement;
    private shippingAddressInput: HTMLInputElement;
    private errorMessage: HTMLElement;
    private successMessage: HTMLElement;
    private submitButton: HTMLButtonElement;

    constructor() {
        this.form = document.getElementById('signup-form') as HTMLFormElement;
        this.usernameInput = document.getElementById('username') as HTMLInputElement;
        this.passwordInput = document.getElementById('password') as HTMLInputElement;
        this.confirmPasswordInput = document.getElementById('confirm-password') as HTMLInputElement;
        this.shippingAddressInput = document.getElementById('shipping-address') as HTMLInputElement;
        this.errorMessage = document.getElementById('error-message') as HTMLElement;
        this.successMessage = document.getElementById('success-message') as HTMLElement;
        this.submitButton = document.getElementById('signup-btn') as HTMLButtonElement;

        this.init();
    }

    private init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        
        this.confirmPasswordInput.addEventListener('input', this.validatePasswordMatch.bind(this));
        this.usernameInput.addEventListener('input', this.clearMessages.bind(this));
        this.passwordInput.addEventListener('input', this.clearMessages.bind(this));
        this.shippingAddressInput.addEventListener('input', this.clearMessages.bind(this));
    }

    private validatePasswordMatch() {
        if (this.confirmPasswordInput.value && this.passwordInput.value !== this.confirmPasswordInput.value) {
            this.confirmPasswordInput.setCustomValidity('Passwords do not match');
        } else {
            this.confirmPasswordInput.setCustomValidity('');
        }
    }

    private clearMessages() {
        this.hideError();
        this.hideSuccess();
    }

    private async handleSubmit(event: Event) {
        event.preventDefault();

        if (!this.validateForm()) {
            return;
        }

        this.setLoading(true);
        this.clearMessages();

        try {
            const formData = this.getFormData();
            const response = await fetch('/signin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                localStorage.setItem('userId', data.userId.toString());
                localStorage.setItem('username', formData.username);
                
                this.showSuccess('Account created successfully! Redirecting to your profile...');
                
                setTimeout(() => {
                    window.location.href = '/account.html';
                }, 2000);
            } else {
                this.showError(data.error || 'Failed to create account');
            }
        } catch (error) {
            console.error('Signup error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }

    private validateForm(): boolean {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;
        const confirmPassword = this.confirmPasswordInput.value;
        const shippingAddress = this.shippingAddressInput.value.trim();

        if (!username) {
            this.showError('Username is required');
            this.usernameInput.focus();
            return false;
        }

        if (username.length < 3) {
            this.showError('Username must be at least 3 characters long');
            this.usernameInput.focus();
            return false;
        }

        if (!password) {
            this.showError('Password is required');
            this.passwordInput.focus();
            return false;
        }

        if (password.length < 6) {
            this.showError('Password must be at least 6 characters long');
            this.passwordInput.focus();
            return false;
        }

        if (password !== confirmPassword) {
            this.showError('Passwords do not match');
            this.confirmPasswordInput.focus();
            return false;
        }

        if (!shippingAddress) {
            this.showError('Delivery address is required');
            this.shippingAddressInput.focus();
            return false;
        }

        return true;
    }

    private getFormData() {
        const selectedImage = document.querySelector('input[name="profile_image"]:checked') as HTMLInputElement;
        
        return {
            username: this.usernameInput.value.trim(),
            password: this.passwordInput.value,
            profile_image_url: selectedImage?.value || '/assets/default.png',
            shipping_address: this.shippingAddressInput.value.trim()
        };
    }

    private setLoading(loading: boolean) {
        const signupText = document.getElementById('signup-text');
        const signupLoading = document.getElementById('signup-loading');

        if (loading) {
            this.submitButton.disabled = true;
            signupText?.classList.add('hidden');
            signupLoading?.classList.remove('hidden');
        } else {
            this.submitButton.disabled = false;
            signupText?.classList.remove('hidden');
            signupLoading?.classList.add('hidden');
        }
    }

    private showError(message: string) {
        this.errorMessage.textContent = message;
        this.errorMessage.classList.remove('hidden');
        this.successMessage.classList.add('hidden');
    }

    private showSuccess(message: string) {
        this.successMessage.textContent = message;
        this.successMessage.classList.remove('hidden');
        this.errorMessage.classList.add('hidden');
    }

    private hideError() {
        this.errorMessage.classList.add('hidden');
    }

    private hideSuccess() {
        this.successMessage.classList.add('hidden');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new SignupPage();
});
