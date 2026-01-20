// ============================================
// INTEGRATION EXAMPLES
// How to call the WhatsApp Microservice from RachaAI
// ============================================

// Configuration
const WHATSAPP_SERVICE_URL = process.env.VITE_WHATSAPP_SERVICE_URL || 'http://localhost:3000';
const WHATSAPP_API_KEY = process.env.VITE_WHATSAPP_API_KEY || 'your-api-key';

// ============================================
// EXAMPLE 1: Send OTP during signup
// ============================================

/**
 * Call this when user signs up with phone number
 * Location: src/pages/PhoneAuthPage.tsx or src/lib/evolutionApi.ts
 */
export async function sendOTPViaWhatsApp(phoneNumber, otpCode) {
    try {
        const response = await fetch(`${WHATSAPP_SERVICE_URL}/v1/send-otp`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': WHATSAPP_API_KEY
            },
            body: JSON.stringify({
                number: phoneNumber, // Format: "11999999999"
                code: otpCode         // Format: "123456"
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to send OTP');
        }

        console.log('✅ OTP sent successfully:', data);
        return data;

    } catch (error) {
        console.error('❌ Error sending OTP:', error);
        throw error;
    }
}

// Usage example in PhoneAuthPage.tsx:
/*
const handleSendOTP = async () => {
  const code = generateOTP(); // Your existing function
  
  try {
    // Send via WhatsApp instead of Evolution API
    await sendOTPViaWhatsApp(phoneNumber, code);
    
    // Store OTP for validation
    storeOTP(phoneNumber, code);
    
    toast({
      title: "Código enviado!",
      description: "Verifique seu WhatsApp"
    });
  } catch (error) {
    toast({
      title: "Erro ao enviar código",
      variant: "destructive"
    });
  }
};
*/

// ============================================
// EXAMPLE 2: Send billing notifications
// ============================================

/**
 * Call this from a scheduled job (cron) to notify users about payments
 * Can be triggered daily to check due dates
 */
export async function sendBillingNotification(phoneNumber, notificationType, groupData) {
    try {
        const response = await fetch(`${WHATSAPP_SERVICE_URL}/v1/notify-billing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': WHATSAPP_API_KEY
            },
            body: JSON.stringify({
                number: phoneNumber,
                type: notificationType,  // "D-1", "D0", or "D+1"
                service: groupData.name,
                value: groupData.amountPerPerson.toFixed(2),
                pixKey: groupData.leaderPixKey
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to send notification');
        }

        console.log('✅ Billing notification sent:', data);
        return data;

    } catch (error) {
        console.error('❌ Error sending billing notification:', error);
        throw error;
    }
}

// ============================================
// EXAMPLE 3: Automated billing reminder system
// ============================================

/**
 * This function should be called daily (via cron job or scheduled function)
 * It checks all groups and sends appropriate notifications
 */
export async function processAutomatedBillingReminders() {
    try {
        // Fetch all groups with upcoming due dates
        const { data: groups, error } = await supabase
            .from('groups')
            .select(`
        *,
        group_members(
          *,
          profiles(phone, pix_key)
        )
      `)
            .not('next_due_date', 'is', null);

        if (error) throw error;

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const group of groups) {
            const dueDate = new Date(group.next_due_date);
            dueDate.setHours(0, 0, 0, 0);

            const diffDays = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24));

            // Get leader's PIX key
            const leader = group.group_members.find(m => m.is_leader);
            const leaderPixKey = leader?.profiles?.pix_key || 'Não informado';

            // Send notifications based on days until due
            for (const member of group.group_members) {
                // Skip if already paid
                if (member.status === 'paid') continue;

                // Skip if no phone number
                if (!member.profiles?.phone) continue;

                let notificationType = null;

                if (diffDays === 1) {
                    notificationType = 'D-1'; // Tomorrow
                } else if (diffDays === 0) {
                    notificationType = 'D0';  // Today
                } else if (diffDays === -1) {
                    notificationType = 'D+1'; // Yesterday (overdue)
                }

                if (notificationType) {
                    await sendBillingNotification(
                        member.profiles.phone,
                        notificationType,
                        {
                            name: group.name,
                            amountPerPerson: group.amount_per_person,
                            leaderPixKey: leaderPixKey
                        }
                    );

                    // Add small delay between messages
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            }
        }

        console.log('✅ Automated billing reminders processed');

    } catch (error) {
        console.error('❌ Error processing billing reminders:', error);
        throw error;
    }
}

// ============================================
// EXAMPLE 4: Setup in RachaAI
// ============================================

/**
 * Add these environment variables to your RachaAI .env file:
 * 
 * VITE_WHATSAPP_SERVICE_URL=https://your-microservice.onrender.com
 * VITE_WHATSAPP_API_KEY=your-secret-api-key
 */

// ============================================
// EXAMPLE 5: Create a cron job (optional)
// ============================================

/**
 * If deploying to Vercel/Netlify, create an API route:
 * 
 * File: api/cron/billing-reminders.js
 */
/*
export default async function handler(req, res) {
  // Verify cron secret
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await processAutomatedBillingReminders();
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
*/

/**
 * Then configure a cron job service (cron-job.org, EasyCron, etc.) to call:
 * POST https://your-rachaai.vercel.app/api/cron/billing-reminders
 * Authorization: Bearer your-cron-secret
 * 
 * Schedule: Daily at 9:00 AM
 */

// ============================================
// EXAMPLE 6: Test the integration
// ============================================

/**
 * Quick test function - call this to verify everything works
 */
export async function testWhatsAppIntegration() {
    console.log('🧪 Testing WhatsApp integration...');

    // Test 1: Health check
    try {
        const healthResponse = await fetch(`${WHATSAPP_SERVICE_URL}/health`);
        const healthData = await healthResponse.json();
        console.log('✅ Health check:', healthData);
    } catch (error) {
        console.error('❌ Health check failed:', error);
        return;
    }

    // Test 2: Send OTP to yourself
    try {
        await sendOTPViaWhatsApp('11999999999', '123456'); // Replace with your number
        console.log('✅ OTP test passed');
    } catch (error) {
        console.error('❌ OTP test failed:', error);
    }

    // Test 3: Send billing notification to yourself
    try {
        await sendBillingNotification('11999999999', 'D-1', {
            name: 'Netflix Premium',
            amountPerPerson: 14.90,
            leaderPixKey: 'email@exemplo.com'
        });
        console.log('✅ Billing notification test passed');
    } catch (error) {
        console.error('❌ Billing notification test failed:', error);
    }

    console.log('🎉 Integration tests complete!');
}

// ============================================
// NOTES
// ============================================

/**
 * IMPORTANT REMINDERS:
 * 
 * 1. The microservice must be running and connected to WhatsApp
 * 2. Phone numbers should be in format: "11999999999" (no spaces, dashes, or +55)
 * 3. The microservice will format numbers automatically
 * 4. Always handle errors gracefully
 * 5. Add delays between bulk messages to avoid spam detection
 * 6. Test with your own number first!
 * 7. Keep the API key secret - never commit it to Git
 */
