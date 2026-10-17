-- ============================================================================
-- Shahin Sha Portfolio - Idempotent Data Import Migration
-- Dedicated Supabase Project: yaxyqpwsxknahehhmtch
-- ============================================================================

BEGIN;

-- 1. PUBLIC PROFILES
INSERT INTO public.public_profiles (
    id, full_name, headline, bio, avatar_url, location, social_links, is_published, created_at, updated_at
)
SELECT 
    '00000000-0000-0000-0000-000000000001'::uuid,
    'Shahin Sha Chakkingathodi',
    'Full-Stack Developer & CS Engineering Student',
    'Self-motivated B.Tech Computer Science and Engineering student at MEA Engineering College, Malappuram. Passionate about developing practical and user-friendly software solutions with an interest in full-stack development, front-end development, and backend systems. Currently expanding into Cloud & DevOps.',
    'images/avatar.jpg',
    'Malappuram, Kerala, India',
    '{"github":"https://github.com/Shahinshac","linkedin":"https://www.linkedin.com/in/shahinshac","twitter":"https://x.com/shaahn_c","instagram":"https://instagram.com/shaahn_c"}'::jsonb,
    true,
    now(),
    now()
WHERE NOT EXISTS (
    SELECT 1 FROM public.public_profiles WHERE full_name = 'Shahin Sha Chakkingathodi'
);

-- 2. PRIVATE ADMIN PROFILE
INSERT INTO public.admin_profile_private (
    id, email, phone, address, notes, created_at, updated_at
)
SELECT
    '00000000-0000-0000-0000-000000000002'::uuid,
    'shahin.c.sha@gmail.com',
    '+917594012761',
    'Malappuram, Kerala, India',
    'Primary administrator account for portfolio CMS management.',
    now(),
    now()
WHERE NOT EXISTS (
    SELECT 1 FROM public.admin_profile_private WHERE email = 'shahin.c.sha@gmail.com'
);

-- 3. PROJECTS (All 8 verified portfolio systems)
INSERT INTO public.projects (title, description, category, tags, github_url, live_url, display_order, is_published)
SELECT p.title, p.description, p.category, p.tags, p.github_url, p.live_url, p.display_order, p.is_published
FROM (VALUES
    (
        'HospitalOS + PharmacyERP',
        'Integrated clinical operations and pharmacy inventory platform featuring patient record tracking, medication dispensing with FEFO stock rotation, and dual web and desktop clients.',
        'fullstack',
        ARRAY['NestJS', 'React', 'TypeScript', 'Prisma', 'PostgreSQL', 'Docker', 'C#'],
        'https://github.com/Shahinshac/HospitalOs',
        NULL::text,
        1,
        true
    ),
    (
        'Restaurant Billing & Real-Time POS',
        'A food-service management system designed to accelerate table turnover, push waitstaff orders instantly to kitchen display stations, and streamline customer bill settlement with integrated digital payments.',
        'realtime',
        ARRAY['Next.js', 'Node.js', 'Express', 'Socket.io', 'Prisma', 'PostgreSQL', 'Razorpay'],
        'https://github.com/Shahinshac/restaurant-billing',
        'https://26-07billing.vercel.app/',
        2,
        true
    ),
    (
        'Core Banking System (CBS)',
        'A core financial management engine simulating retail banking workflows, credit assessment schedules, and transactional ledger accounting with strict audit logging.',
        'backend',
        ARRAY['React', 'TypeScript', 'Python Flask', 'Flask-SQLAlchemy', 'PostgreSQL', 'JWT'],
        'https://github.com/Shahinshac/CBS',
        'https://shaahn.vercel.app/',
        3,
        true
    ),
    (
        'CoreERP Enterprise Suite',
        'Centralized enterprise resource planning platform integrating multi-department employee directories, warehouse inventory dispatch, and financial audit logs into a unified dashboard.',
        'erp',
        ARRAY['React', 'TypeScript', 'Node.js', 'Express', 'PostgreSQL', 'Prisma'],
        'https://github.com/Shahinshac/CoreERP',
        'https://core-erpp.vercel.app/',
        4,
        true
    ),
    (
        'Expense Tracker & Financial Analytics',
        'Interactive personal finance application monitoring expenditures, category budget thresholds, and spending analytics via real-time Chart.js visual graphs.',
        'fullstack',
        ARRAY['React', 'TypeScript', 'Vite', 'Node.js', 'PostgreSQL', 'Chart.js'],
        'https://github.com/Shahinshac/Expense-Tracker',
        'https://expensfi.vercel.app/',
        5,
        true
    ),
    (
        'Yumm (Nex-Food) Ordering Platform',
        'Modern food ordering platform featuring restaurant menus, dynamic multi-item cart calculations, persistent checkout flows, and responsive mobile-first UI.',
        'fullstack',
        ARRAY['Next.js', 'TypeScript', 'Node.js', 'PostgreSQL', 'TailwindCSS'],
        'https://github.com/Shahinshac/Yumm',
        'https://nex-food.vercel.app',
        6,
        true
    ),
    (
        'AI Resume Screening & Ranking',
        'Recruitment intelligence tool parsing candidate resumes from PDFs, tokenizing skills, and ranking applicants against job descriptions using TF-IDF and cosine similarity.',
        'python',
        ARRAY['Python', 'Flask', 'NLP', 'scikit-learn', 'PyPDF2', 'Pandas'],
        'https://github.com/Shahinshac/AI-Resume-screening',
        NULL::text,
        7,
        true
    ),
    (
        'Company Management System',
        'Corporate hierarchy and employee operations portal featuring organizational department tree navigation, role-based access audits, and leave request tracking.',
        'fullstack',
        ARRAY['JavaScript', 'React', 'Node.js', 'Express', 'MongoDB'],
        'https://github.com/Shahinshac/company-management-system',
        'https://company-managament.vercel.app/login.html',
        8,
        true
    )
) AS p(title, description, category, tags, github_url, live_url, display_order, is_published)
WHERE NOT EXISTS (
    SELECT 1 FROM public.projects WHERE LOWER(public.projects.title) = LOWER(p.title)
);

-- 4. SKILLS (22 verified core skills)
INSERT INTO public.skills (name, category, proficiency, icon_class, display_order, is_published)
SELECT s.name, s.category, s.proficiency, s.icon_class, s.display_order, s.is_published
FROM (VALUES
    -- Languages
    ('JavaScript (ES6+)', 'Languages', 95, 'fa-brands fa-js', 1, true),
    ('TypeScript', 'Languages', 90, 'fa-brands fa-js', 2, true),
    ('Python', 'Languages', 85, 'fa-brands fa-python', 3, true),
    ('Java', 'Languages', 75, 'fa-brands fa-java', 4, true),
    ('C#', 'Languages', 72, 'fa-solid fa-code', 5, true),
    -- Frontend
    ('React', 'Frontend', 94, 'fa-brands fa-react', 1, true),
    ('Next.js', 'Frontend', 90, 'fa-solid fa-n', 2, true),
    ('HTML5 / Modern CSS', 'Frontend', 96, 'fa-brands fa-html5', 3, true),
    ('Vite', 'Frontend', 88, 'fa-solid fa-bolt', 4, true),
    ('Tailwind CSS', 'Frontend', 86, 'fa-solid fa-wind', 5, true),
    -- Backend
    ('NestJS', 'Backend', 90, 'fa-solid fa-server', 1, true),
    ('Node.js & Express', 'Backend', 92, 'fa-brands fa-node-js', 2, true),
    ('Python & Flask', 'Backend', 85, 'fa-brands fa-python', 3, true),
    ('REST APIs', 'Backend', 92, 'fa-solid fa-network-wired', 4, true),
    ('WebSockets', 'Backend', 86, 'fa-solid fa-bolt-lightning', 5, true),
    -- Databases
    ('PostgreSQL', 'Databases', 90, 'fa-solid fa-database', 1, true),
    ('Prisma ORM', 'Databases', 88, 'fa-solid fa-database', 2, true),
    ('MongoDB', 'Databases', 84, 'fa-solid fa-leaf', 3, true),
    ('Flask-SQLAlchemy', 'Databases', 82, 'fa-solid fa-database', 4, true),
    -- Cloud & DevOps
    ('Docker & Containers', 'Cloud & DevOps', 82, 'fa-brands fa-docker', 1, true),
    ('Git & GitHub Actions', 'Cloud & DevOps', 88, 'fa-brands fa-git-alt', 2, true),
    ('Linux & Bash', 'Cloud & DevOps', 80, 'fa-brands fa-linux', 3, true)
) AS s(name, category, proficiency, icon_class, display_order, is_published)
WHERE NOT EXISTS (
    SELECT 1 FROM public.skills WHERE LOWER(public.skills.name) = LOWER(s.name)
);

-- 5. EXPERIENCE (Verified Internship from Resume)
INSERT INTO public.experience (role, company, location, start_date, end_date, is_current, description, highlights, display_order, is_published)
SELECT e.role, e.company, e.location, e.start_date, e.end_date, e.is_current, e.description, e.highlights, e.display_order, e.is_published
FROM (VALUES
    (
        'Front-End Web Development Intern',
        'CoreMicron Enterprises LLP',
        'Kottakkal, Kerala, India',
        'June 2026',
        'June 2026',
        false,
        'Completed Front-End Web Development Internship gaining practical experience in developing responsive, user-friendly web pages and ERP invoice modules.',
        ARRAY[
            'Developed responsive and user-friendly web pages using HTML, CSS, Bootstrap, and JavaScript',
            'Contributed to ERP invoice module development and web application customization',
            'Implemented interactive UI components and client-side form verification'
        ],
        1,
        true
    )
) AS e(role, company, location, start_date, end_date, is_current, description, highlights, display_order, is_published)
WHERE NOT EXISTS (
    SELECT 1 FROM public.experience WHERE LOWER(public.experience.role) = LOWER(e.role) AND LOWER(public.experience.company) = LOWER(e.company)
);

-- 6. EDUCATION (3 verified degrees from Resume & Portfolio)
INSERT INTO public.education (institution, degree, field_of_study, start_date, end_date, grade, display_order, is_published)
SELECT ed.institution, ed.degree, ed.field_of_study, ed.start_date, ed.end_date, ed.grade, ed.display_order, ed.is_published
FROM (VALUES
    (
        'MEA Engineering College, Malappuram (APJ Abdul Kalam Technological University)',
        'B.Tech in Computer Science & Engineering',
        'Computer Science and Engineering',
        '2024',
        'Present',
        'Currently pursuing third year',
        1,
        true
    ),
    (
        'GHSS Kadungapuram, Malappuram, Kerala',
        'Higher Secondary Education',
        'Biology Science & Computer Science',
        '2022',
        '2024',
        'Higher Secondary',
        2,
        true
    ),
    (
        'GHSS Kadungapuram, Kerala',
        'Secondary School Leaving Certificate (SSLC)',
        'Science & Mathematics',
        '2021',
        '2022',
        'SSLC',
        3,
        true
    )
) AS ed(institution, degree, field_of_study, start_date, end_date, grade, display_order, is_published)
WHERE NOT EXISTS (
    SELECT 1 FROM public.education WHERE LOWER(public.education.degree) = LOWER(ed.degree)
);

-- 7. CERTIFICATIONS (3 verified credentials from Resume)
INSERT INTO public.certifications (title, issuer, issue_date, credential_id, credential_url, display_order, is_published)
SELECT c.title, c.issuer, c.issue_date, c.credential_id, c.credential_url, c.display_order, c.is_published
FROM (VALUES
    (
        'Digital 101 – 30 Hours',
        'FutureSkills Prime – NASSCOM',
        'May 2025',
        NULL::text,
        NULL::text,
        1,
        true
    ),
    (
        'Certificate Course in Cyber Awareness AI Basic',
        'NIIT Foundation – Cyber Suraksha Plus Program',
        'August 2026',
        NULL::text,
        NULL::text,
        2,
        true
    ),
    (
        'Foundations of AI: Principles, Applications, and Future Trends',
        'Additional Skill Acquisition Programme (ASAP Kerala) & 360DigiTMG',
        '2025',
        NULL::text,
        NULL::text,
        3,
        true
    )
) AS c(title, issuer, issue_date, credential_id, credential_url, display_order, is_published)
WHERE NOT EXISTS (
    SELECT 1 FROM public.certifications WHERE LOWER(public.certifications.title) = LOWER(c.title)
);

COMMIT;
