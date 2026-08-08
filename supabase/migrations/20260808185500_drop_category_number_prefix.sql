-- Drop the "N. " numeric prefix from category names (sort_order already controls ordering)
update public.categories set name = 'Daily Communication'      where slug = 'daily-communication';
update public.categories set name = 'Meetings & Discussions'   where slug = 'meetings-discussion';
update public.categories set name = 'Negotiation & Strategy'   where slug = 'negotiation-strategy';
update public.categories set name = 'Management & Operations' where slug = 'management-operations';
update public.categories set name = 'Email & Clients'         where slug = 'email-clients';
