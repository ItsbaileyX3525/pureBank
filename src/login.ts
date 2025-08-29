class LoginPage {
    private form: HTMLFormElement;
    private usernameInput: HTMLInputElement;
    private passwordInput: HTMLInputElement;
    private errorMessage: HTMLElement;
    private successMessage: HTMLElement;
    private submitButton: HTMLButtonElement;

    constructor() {
        this.form = document.getElementById('login-form') as HTMLFormElement;
        this.usernameInput = document.getElementById('username') as HTMLInputElement;
        this.passwordInput = document.getElementById('password') as HTMLInputElement;
        this.errorMessage = document.getElementById('error-message') as HTMLElement;
        this.successMessage = document.getElementById('success-message') as HTMLElement;
        this.submitButton = document.getElementById('login-btn') as HTMLButtonElement;

        this.init();
    }

    private init() {
        this.form.addEventListener('submit', this.handleSubmit.bind(this));
        this.usernameInput.addEventListener('input', this.clearMessages.bind(this));
        this.passwordInput.addEventListener('input', this.clearMessages.bind(this));
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
            const response = await fetch('/login', {
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
                
                this.showSuccess('Login successful! Redirecting to your profile...');
                
                setTimeout(() => {
                    window.location.href = '/account.html';
                }, 1000);
            } else {
                this.showError(data.error || 'Invalid username or password');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showError('Network error. Please try again.');
        } finally {
            this.setLoading(false);
        }
    }

    private validateForm(): boolean {
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value;

        if (!username) {
            this.showError('Username is required');
            this.usernameInput.focus();
            return false;
        }

        if (!password) {
            this.showError('Password is required');
            this.passwordInput.focus();
            return false;
        }

        return true;
    }

    private getFormData() {
        return {
            username: this.usernameInput.value.trim(),
            password: this.passwordInput.value
        };
    }

    private setLoading(loading: boolean) {
        const loginText = document.getElementById('login-text');
        const loginLoading = document.getElementById('login-loading');

        if (loading) {
            this.submitButton.disabled = true;
            loginText?.classList.add('hidden');
            loginLoading?.classList.remove('hidden');
        } else {
            this.submitButton.disabled = false;
            loginText?.classList.remove('hidden');
            loginLoading?.classList.add('hidden');
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
    new LoginPage();
});
