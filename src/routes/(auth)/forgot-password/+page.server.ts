import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';
import { db } from '$lib/database';
import crypto from 'crypto';
import { sendPasswordResetEmail } from '$lib/emailService';

export const actions: Actions = {
  forgotPassword: async ({ request }) => {
    const data = await request.formData();
    const email = data.get('email')?.toString().trim();

    if (!email) {
      return fail(400, { error: 'Please provide an email address.' });
    }

    try {
      const user = await db.user.findUnique({ where: { email } });

      if (!user) {
        return fail(400, { error: 'No account found with this email.' });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

      await db.user.update({
        where: { email },
        data: {
          resetToken,
          resetTokenExpiry
        }
      });

      await sendPasswordResetEmail(email, resetToken);

      return {
        success: true
      };
    } catch (error) {
      console.error('Password reset error:', error);
      return fail(500, { error: 'An error occurred. Please try again later.' });
    }
  }
};