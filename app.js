// API Base URL
const API_URL = 'http://localhost:5050/api';

// Check if user is logged in on page load
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('kodnest_token');
    if (token) {
        showDashboard();
    } else {
        showAuth();
    }
});

// Tab switching
function showLogin() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('register-form').classList.add('hidden');
    document.getElementById('login-tab').classList.add('text-indigo-600', 'border-indigo-600', 'bg-white');
    document.getElementById('login-tab').classList.remove('text-gray-500', 'border-transparent', 'bg-gray-50');
    document.getElementById('register-tab').classList.remove('text-indigo-600', 'border-indigo-600', 'bg-white');
    document.getElementById('register-tab').classList.add('text-gray-500', 'border-transparent', 'bg-gray-50');
}

function showRegister() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('register-form').classList.remove('hidden');
    document.getElementById('register-tab').classList.add('text-indigo-600', 'border-indigo-600', 'bg-white');
    document.getElementById('register-tab').classList.remove('text-gray-500', 'border-transparent', 'bg-gray-50');
    document.getElementById('login-tab').classList.remove('text-indigo-600', 'border-indigo-600', 'bg-white');
    document.getElementById('login-tab').classList.add('text-gray-500', 'border-transparent', 'bg-gray-50');
}

// Handle Login
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            // Store token in localStorage
            localStorage.setItem('kodnest_token', data.token);
            localStorage.setItem('kodnest_customer_id', data.customer_id);
            localStorage.setItem('kodnest_name', data.name);
            
            showDashboard();
        } else {
            errorDiv.textContent = data.error || 'Login failed';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}

// Handle Register
async function handleRegister(event) {
    event.preventDefault();
    
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const errorDiv = document.getElementById('register-error');
    const successDiv = document.getElementById('register-success');
    
    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            successDiv.textContent = 'Registration successful! Please login.';
            successDiv.classList.remove('hidden');
            errorDiv.classList.add('hidden');
            
            // Clear form
            document.getElementById('register-name').value = '';
            document.getElementById('register-email').value = '';
            document.getElementById('register-password').value = '';
            
            // Switch to login after 2 seconds
            setTimeout(() => {
                showLogin();
                successDiv.classList.add('hidden');
            }, 2000);
        } else {
            errorDiv.textContent = data.error || 'Registration failed';
            errorDiv.classList.remove('hidden');
            successDiv.classList.add('hidden');
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.classList.remove('hidden');
        successDiv.classList.add('hidden');
    }
}

// Show Dashboard
function showDashboard() {
    document.getElementById('auth-container').classList.add('hidden');
    document.getElementById('dashboard-container').classList.remove('hidden');
    document.getElementById('nav-user').classList.remove('hidden');
    
    const name = localStorage.getItem('kodnest_name') || 'User';
    document.getElementById('user-name').textContent = name;
    document.getElementById('dashboard-name').textContent = name;
}

// Show Auth
function showAuth() {
    document.getElementById('auth-container').classList.remove('hidden');
    document.getElementById('dashboard-container').classList.add('hidden');
    document.getElementById('nav-user').classList.add('hidden');
    showLogin();
}

// Check Balance
async function checkBalance() {
    const token = localStorage.getItem('kodnest_token');
    
    if (!token) {
        showAuth();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/balance`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            document.getElementById('balance-amount').textContent = `$${data.balance.toFixed(2)}`;
            document.getElementById('customer-id').textContent = data.customer_id;
            document.getElementById('balance-display').classList.remove('hidden');
            document.getElementById('send-money-form').classList.add('hidden');
        } else {
            alert(data.error || 'Failed to fetch balance');
            if (response.status === 401) {
                logout();
            }
        }
    } catch (error) {
        alert('Network error. Please try again.');
    }
}

// Show Send Money Form
function showSendMoney() {
    document.getElementById('send-money-form').classList.remove('hidden');
    document.getElementById('balance-display').classList.add('hidden');
    document.getElementById('send-error').classList.add('hidden');
    document.getElementById('send-success').classList.add('hidden');
}

// Hide Send Money Form
function hideSendMoney() {
    document.getElementById('send-money-form').classList.add('hidden');
    document.getElementById('recipient-id').value = '';
    document.getElementById('send-amount').value = '';
}

// Handle Send Money
async function handleSendMoney(event) {
    event.preventDefault();
    
    const token = localStorage.getItem('kodnest_token');
    const recipientId = document.getElementById('recipient-id').value;
    const amount = document.getElementById('send-amount').value;
    const errorDiv = document.getElementById('send-error');
    const successDiv = document.getElementById('send-success');
    
    if (!token) {
        showAuth();
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/send`, {
            method: 'POST',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                recipient_id: parseInt(recipientId), 
                amount: parseFloat(amount) 
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            successDiv.textContent = data.message;
            successDiv.classList.remove('hidden');
            errorDiv.classList.add('hidden');
            
            // Clear form
            document.getElementById('recipient-id').value = '';
            document.getElementById('send-amount').value = '';
            
            // Hide form after 2 seconds
            setTimeout(() => {
                hideSendMoney();
                successDiv.classList.add('hidden');
            }, 2000);
        } else {
            errorDiv.textContent = data.error || 'Transfer failed';
            errorDiv.classList.remove('hidden');
            successDiv.classList.add('hidden');
        }
    } catch (error) {
        errorDiv.textContent = 'Network error. Please try again.';
        errorDiv.classList.remove('hidden');
        successDiv.classList.add('hidden');
    }
}

// Logout
async function logout() {
    const token = localStorage.getItem('kodnest_token');
    
    if (token) {
        try {
            await fetch(`${API_URL}/logout`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
        } catch (error) {
            console.error('Logout error:', error);
        }
    }
    
    // Clear localStorage
    localStorage.removeItem('kodnest_token');
    localStorage.removeItem('kodnest_customer_id');
    localStorage.removeItem('kodnest_name');
    
    // Hide balance and send money forms
    document.getElementById('balance-display').classList.add('hidden');
    document.getElementById('send-money-form').classList.add('hidden');
    
    showAuth();
}
