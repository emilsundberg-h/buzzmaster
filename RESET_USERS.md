# Reset Users & Setup Admin - Quick Guide

**Date Created:** 2025-11-29  
**Purpose:** Clean user database and create proper admin user

---

## 🗑️ Step 1: Delete All Users

Run this command to see current users:

```bash
DATABASE_URL="postgresql://postgres:EzHhTgxdpIStqgievJiOdMvwTrzbEBjm@trolley.proxy.rlwy.net:38229/railway" \
npx tsx scripts/list-users.ts
```

---

## 🧹 Step 2: Delete Specific Users

To delete a user by username:

```bash
DATABASE_URL="postgresql://postgres:EzHhTgxdpIStqgievJiOdMvwTrzbEBjm@trolley.proxy.rlwy.net:38229/railway" \
npx tsx scripts/delete-user.ts "USERNAME_HERE"
```

**Example - Delete "Admin" user:**
```bash
DATABASE_URL="postgresql://postgres:EzHhTgxdpIStqgievJiOdMvwTrzbEBjm@trolley.proxy.rlwy.net:38229/railway" \
npx tsx scripts/delete-user.ts "Admin"
```

**Repeat for each user you want to remove.**

---

## 👤 Step 3: Create Admin User

**IMPORTANT:** First, get your Clerk User ID!

1. Go to `https://buzz.healthymountain.org/dev-admin`
2. Login with your admin email
3. Check Railway logs for your Clerk ID:
   - Look for: `🎮 Clerk userId: user_XXXXX`
   - Or check console in browser DevTools

Then update and run:

```bash
# Edit scripts/create-admin.ts first!
# Change line 12: const adminClerkId = 'YOUR_CLERK_ID_HERE';

DATABASE_URL="postgresql://postgres:EzHhTgxdpIStqgievJiOdMvwTrzbEBjm@trolley.proxy.rlwy.net:38229/railway" \
npx tsx scripts/create-admin.ts
```

---

## ✅ Step 4: Verify

List users again to confirm:

```bash
DATABASE_URL="postgresql://postgres:EzHhTgxdpIStqgievJiOdMvwTrzbEBjm@trolley.proxy.rlwy.net:38229/railway" \
npx tsx scripts/list-users.ts
```

You should see your admin user with:
- **Username:** Emil (or whatever you set)
- **Clerk ID:** Your actual Clerk ID
- **Avatar:** 02 (Beckham)
- **Captain:** David Beckham

---

## 🚨 Troubleshooting

### "Unique constraint failed on username"
- User already exists with that username
- Delete the old user first, or choose a different username

### "Unique constraint failed on avatarKey"
- Avatar is already taken
- Change to a different avatar (01-08)
- In `scripts/create-admin.ts`, change:
  - `avatarKey: '02'` → `'03'` (or any other)
  - Also update the captain accordingly

### "Captain player not found"
- Run captains seed first:
  ```bash
  DATABASE_URL="postgresql://..." npx tsx prisma/seed-captains.ts
  ```

---

## 📝 Available Avatars & Captains

| Avatar | Captain | Position |
|--------|---------|----------|
| 01 | Roberto Baggio | FWD |
| 02 | David Beckham | MID |
| 03 | Tomas Brolin | MID |
| 04 | Oliver Giroud | FWD |
| 05 | Ronaldinho | MID |
| 06 | Ronaldo | FWD |
| 07 | Francesco Totti | MID |
| 08 | Zinedine Zidane | MID |

---

## 🔐 Important Notes

- **Admin Email:** Must match `ADMIN_EMAIL_ALLOWLIST` in Railway env vars
- **Database URL:** Always use Railway production database URL
- **Clerk ID:** Get from Railway logs or browser console
- **Never commit** database credentials to git!

---

## 📂 Script Locations

- List users: `scripts/list-users.ts`
- Delete user: `scripts/delete-user.ts`
- Create admin: `scripts/create-admin.ts`
- Check submissions: `scripts/check-submissions.ts`

---

**Last Admin Created:**
- Username: Emil
- Clerk ID: user_34YZEwyUER1sRLKYa4YOYoPUkMI
- Avatar: 02 (Beckham)
- Date: 2025-11-29
