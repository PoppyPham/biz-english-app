-- Translate category names from Vietnamese to English for UI consistency
update public.categories set name = '1. Daily Communication'      where slug = 'daily-communication';
update public.categories set name = '2. Meetings & Discussions'   where slug = 'meetings-discussion';
update public.categories set name = '3. Negotiation & Strategy'   where slug = 'negotiation-strategy';
update public.categories set name = '4. Management & Operations' where slug = 'management-operations';
update public.categories set name = '5. Email & Clients'          where slug = 'email-clients';
