from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import secrets
import hashlib
from datetime import datetime, timedelta
import os

app = Flask(__name__)
CORS(app)

DATABASE = 'kodnest.db'

# Initialize database
def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            balance REAL DEFAULT 1000.0
        )
    ''')
    
    # Tokens table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tokens (
            token_id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            token_string TEXT UNIQUE NOT NULL,
            expiry TIMESTAMP NOT NULL,
            FOREIGN KEY (customer_id) REFERENCES users (customer_id)
        )
    ''')
    
    conn.commit()
    conn.close()

# Hash password
def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

# Generate token
def generate_token():
    return secrets.token_urlsafe(32)

# Verify token
def verify_token(token_string):
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT t.customer_id, t.expiry, u.balance, u.name, u.email
        FROM tokens t
        JOIN users u ON t.customer_id = u.customer_id
        WHERE t.token_string = ?
    ''', (token_string,))
    
    result = cursor.fetchone()
    conn.close()
    
    if result:
        customer_id, expiry, balance, name, email = result
        expiry_time = datetime.fromisoformat(expiry)
        if datetime.now() < expiry_time:
            return {
                'customer_id': customer_id,
                'balance': balance,
                'name': name,
                'email': email
            }
    return None

# Register endpoint
@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    name = data.get('name')
    email = data.get('email')
    password = data.get('password')
    
    if not all([name, email, password]):
        return jsonify({'error': 'All fields are required'}), 400
    
    hashed_password = hash_password(password)
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO users (name, email, password)
            VALUES (?, ?, ?)
        ''', (name, email, hashed_password))
        conn.commit()
        conn.close()
        return jsonify({'message': 'User registered successfully'}), 201
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({'error': 'Email already exists'}), 409

# Login endpoint
@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email')
    password = data.get('password')
    
    if not all([email, password]):
        return jsonify({'error': 'Email and password are required'}), 400
    
    hashed_password = hash_password(password)
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT customer_id, name FROM users
        WHERE email = ? AND password = ?
    ''', (email, hashed_password))
    
    result = cursor.fetchone()
    
    if result:
        customer_id, name = result
        token = generate_token()
        expiry = datetime.now() + timedelta(hours=24)
        
        cursor.execute('''
            INSERT INTO tokens (customer_id, token_string, expiry)
            VALUES (?, ?, ?)
        ''', (customer_id, token, expiry.isoformat()))
        conn.commit()
        conn.close()
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'customer_id': customer_id,
            'name': name
        }), 200
    else:
        conn.close()
        return jsonify({'error': 'Invalid credentials'}), 401

# Check balance endpoint
@app.route('/api/balance', methods=['GET'])
def check_balance():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Authorization header missing'}), 401
    
    token = auth_header.split(' ')[1]
    user = verify_token(token)
    
    if user:
        return jsonify({
            'customer_id': user['customer_id'],
            'name': user['name'],
            'email': user['email'],
            'balance': user['balance']
        }), 200
    else:
        return jsonify({'error': 'Invalid or expired token'}), 401

# Send money endpoint
@app.route('/api/send', methods=['POST'])
def send_money():
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return jsonify({'error': 'Authorization header missing'}), 401
    
    token = auth_header.split(' ')[1]
    sender = verify_token(token)
    
    if not sender:
        return jsonify({'error': 'Invalid or expired token'}), 401
    
    data = request.get_json()
    recipient_id = data.get('recipient_id')
    amount = data.get('amount')
    
    if not recipient_id or not amount:
        return jsonify({'error': 'Recipient ID and amount are required'}), 400
    
    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify({'error': 'Amount must be positive'}), 400
    except ValueError:
        return jsonify({'error': 'Invalid amount'}), 400
    
    if sender['customer_id'] == recipient_id:
        return jsonify({'error': 'Cannot send money to yourself'}), 400
    
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    # Check recipient exists
    cursor.execute('SELECT customer_id FROM users WHERE customer_id = ?', (recipient_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Recipient not found'}), 404
    
    # Check sender balance
    if sender['balance'] < amount:
        conn.close()
        return jsonify({'error': 'Insufficient balance'}), 400
    
    # Perform transfer
    cursor.execute('''
        UPDATE users SET balance = balance - ? WHERE customer_id = ?
    ''', (amount, sender['customer_id']))
    
    cursor.execute('''
        UPDATE users SET balance = balance + ? WHERE customer_id = ?
    ''', (amount, recipient_id))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        'message': f'Successfully sent ${amount:.2f} to customer {recipient_id}',
        'new_balance': sender['balance'] - amount
    }), 200

# Logout endpoint
@app.route('/api/logout', methods=['POST'])
def logout():
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header.split(' ')[1]
        conn = sqlite3.connect(DATABASE)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM tokens WHERE token_string = ?', (token,))
        conn.commit()
        conn.close()
    return jsonify({'message': 'Logged out successfully'}), 200

if __name__ == '__main__':
    init_db()
    app.run(debug=False, port=5050)
