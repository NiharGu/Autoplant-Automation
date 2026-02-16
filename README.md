# Autoplant Automation WhatsApp Bot

Automates vehicle allocation and order processing for Autoplant (DFPCL) logistics system via WhatsApp commands.

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://python.org/)

## ✨ Features

- **WhatsApp Integration** - Monitor groups and process commands via QR code login
- **Full Automation** - 20-step Autoplant workflow from search to confirmation
- **Smart Extraction** - Auto-parse vehicle, driver, SO numbers from messages
- **Product Verification** - Intelligent NPK/NPKS detection and validation (NEW)
- **Queue System** - Sequential processing with 10s delays
- **Error Handling** - Screenshot capture + detailed error messages
- **24/7 Uptime** - PM2 process management on Oracle Cloud

##  Quick Start

### Prerequisites

```bash
# Install dependencies
sudo apt-get install chromium-chromedriver
npm install
pip install flask selenium python-dotenv
```

### Configuration

Create `.env` file:

```env
USERNAME=your_autoplant_username
PASSWORD=your_autoplant_password
SS_RECIPIENT_NUM=9876543210  # WhatsApp number for screenshots (without country code)
```

### Run

```bash
# Terminal 1: Start Python server
python ap_kara.py

# Terminal 2: Start WhatsApp bot
node index.js
# Scan QR code with WhatsApp
```

## 📱 Usage

**In WhatsApp group "Test", reply to order message with:**

```
ap kara
Rahul Kumar - 5678
```

**Optional: Specify product type (recommended if SO has multiple products)**
```
ap kara S20         # Smartek product
Rahul Kumar - 5678
```
or
```
ap kara C9          # Croptek product
Rahul Kumar - 5678
```

**Original message format:**
```
MH12AB5678          # Vehicle number
Mumbai 25.5 MT      # Destination + Weight
2200478050          # SO number (starts with 0-3)
9876543210          # Phone (starts with 4-9)

Optional: S20, C9, 9-24-24, etc.  # Product type (can be anywhere)
```

**Bot response:**
- ✅ Success: `Done ✅`
- ⚠️ Partial: `AP done for 24 MT to load 25.5 MT ✅`
- ❌ Error: Error message + screenshot

## 🔄 How It Works

```
1. WhatsApp Monitor → Detect "ap kara" command
2. Extract Data → Parse vehicle, driver, SO, phone from messages
3. Queue Request → Add to processing queue (#0, #1, #2...)
4. Autoplant Login → Automated browser session
5. Search & Commit → Find SO, commit if needed
6. Place Vehicle → Fill vehicle, driver, quantity
7. Submit → Confirm allocation
8. Reply → Send success/error to WhatsApp
9. Screenshot → Send confirmation to recipient
```

**20 Automated Steps:** Login → Search → Commit → Navigate → Select → Fill Details → Calculate Quantity → Submit → Confirm

## 📦 Product Type Verification

Bot auto-detects and verifies product types to prevent wrong material selection. Only rows with **PENDING** or **COMMITTED** status are considered.

**Supported formats:** `S20`, `C9`, `Smartek`, `Croptek`, `9-24-24`, `20:20:0:13`, etc.

- If SO has **one product** → proceeds automatically
- If SO has **multiple products** → user must specify (e.g., `ap kara S20`)
- Product can be mentioned in the original message, quoted message, or `ap kara` command line

## 🛠️ Configuration

### Change Group Name

`index.js` & `commands/ap-kara.js`:
```javascript
if (groupName !== "Test") return; // Change "Test"
```

### Toggle Headless Mode

`ap_kara.py`:
```python
HEADLESS = False  # Set to False to see browser
```

### Paths

- Success: `/home/ubuntu/whatsapp-bot/details.png`
- Error: `/home/ubuntu/whatsapp-bot/error_ss.png`

## 📊 API Reference

### Python Flask (Port 5000)

**POST** `/process-data`

```json
{
  "driver_name": "John Doe",
  "driver_license": "1234",
  "vehicle_num": "MH01AB1234",
  "destination": "Mumbai",
  "weight": "25.5",
  "so_no": "2200478050",
  "phone_num": "9876543210"
}
```

### Node Express (Port 3000)

**GET** `/queue-status` - Current queue status  
**POST** `/send-message` - Send WhatsApp message  
**POST** `/send-status` - Send status update  
**POST** `/clear-queue` - Clear processing queue

## 🐛 Troubleshooting

| Issue | Fix |
|-------|-----|
| QR code not showing | Restart `index.js`, check terminal QR support |
| ChromeDriver error | Match ChromeDriver version to Chrome |
| Connection closed | Re-scan QR, check `auth/` folder |
| SO not found | Verify SO number exists in Autoplant |
| High RAM usage | Check PM2 restart settings, increase swap |

## 🏗️ Production Deployment

<details>
<summary><b>Oracle Cloud + PM2 Setup (Click to expand)</b></summary>

### Oracle Cloud VM
- **Platform:** Oracle Cloud Free Tier
- **OS:** Ubuntu 24.04 LTS
- **RAM:** 1 GB

### Install PM2

```bash
sudo npm install -g pm2
```

### Create `ecosystem.config.js`

```javascript
module.exports = {
  apps: [
    {
      name: 'whatsapp-bot',
      script: 'index.js',
      cron_restart: '0 */6 * * *',
      max_memory_restart: '500M'
    },
    {
      name: 'python-server',
      script: 'ap_kara.py',
      interpreter: 'python3',
      cron_restart: '0 */4 * * *',
      max_memory_restart: '800M'
    }
  ]
};
```

### Start Services

```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup  # Auto-start on boot
```

### Create Swap File (2GB)

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Optimize
sudo sysctl vm.swappiness=10
echo 'vm.swappiness=10' | sudo tee -a /etc/sysctl.conf
```

### Periodic Restarts

**In `ecosystem.config.js`:**
```javascript
cron_restart: '0 */6 * * *'  // Every 6 hours
max_memory_restart: '500M'    // Auto-restart if exceeds 500MB
```

**Or via crontab:**
```bash
crontab -e
# Add:
0 3 * * * pm2 restart all --update-env
```

### PM2 Commands

```bash
pm2 list          # View processes
pm2 logs          # View logs
pm2 monit         # Monitor resources
pm2 restart all   # Restart services
pm2 flush         # Clear logs
```

</details>

## 📁 Project Structure

```
Autoplant-Automation/
├── index.js              # WhatsApp bot
├── ap_kara.py           # Python automation
├── commands/
│   └── ap-kara.js       # Command handler
├── package.json
├── .env                 # Config (create this)
├── ecosystem.config.js  # PM2 config (create this)
└── auth/                # WhatsApp session (auto-generated)
```

## Credits

**AI Assistants:** Google Gemini, Anthropic Claude, GitHub Copilot, ChatGPT

**Contributors:** [@arpitmofficial](https://github.com/arpitmofficial), [Siya Gupta](https://ca.linkedin.com/in/siya-gupta-1a2452258)

**Infrastructure:** Oracle Cloud Free Tier


---

**Tech Stack:** Node.js • Python • Flask • Selenium • Baileys • PM2 • Oracle Cloud

**Status:** Production-ready • 24/7 Uptime • Auto-restart
