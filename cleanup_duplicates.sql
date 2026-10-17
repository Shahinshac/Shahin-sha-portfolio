-- ============================================================================
-- Shahin Sha Portfolio - Database Deduplication & Integrity Migration
-- Dedicated Supabase Project: yaxyqpwsxknahehhmtch
-- ============================================================================
-- This migration:
-- 1. Safely removes the exact 37 duplicate records created by duplicate import
-- 2. Preserves the authentic primary records and all relational data
-- 3. Establishes UNIQUE indexes to guarantee future imports remain 100% idempotent
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. REMOVE DUPLICATE PROJECTS (Keep original 8, remove 8 duplicate IDs)
-- ----------------------------------------------------------------------------
DELETE FROM public.projects 
WHERE id IN (
    'f7d4ed3a-65c9-4906-a156-8ab1e268e17f'::uuid, -- HospitalOS + PharmacyERP
    '0cae42e0-dc8c-4d87-9329-2aa462d0a17d'::uuid, -- Restaurant Billing & Real-Time POS
    '79ca7392-7501-4ad7-ad14-7e2aaf074b74'::uuid, -- Core Banking System (CBS)
    'd84189bb-61c0-4c94-9780-249c40702e9c'::uuid, -- CoreERP Enterprise Suite
    '1921be00-7e36-482b-9bf6-6a64f645a3b2'::uuid, -- Expense Tracker & Financial Analytics
    '48c2ed21-768f-4c4d-93e6-199e5b48728e'::uuid, -- Yumm (Nex-Food) Ordering Platform
    '77d92c9c-1e28-4862-aaf3-fb10c77f19d6'::uuid, -- AI Resume Screening & Ranking
    '419e8649-d7b6-407a-9662-a068880a6ebf'::uuid  -- Company Management System
);

-- Fallback safety check for any remaining duplicates in projects
DELETE FROM public.projects
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(title)) 
            ORDER BY created_at ASC, id ASC
        ) as rn
        FROM public.projects
    ) t WHERE t.rn > 1
);

-- ----------------------------------------------------------------------------
-- 2. REMOVE DUPLICATE SKILLS (Keep original 22, remove 22 duplicate IDs)
-- ----------------------------------------------------------------------------
DELETE FROM public.skills
WHERE id IN (
    '3f6fca32-2ad5-4761-9695-6d374587e820'::uuid, -- JavaScript (ES6+)
    '92e605a1-266b-4cf0-ad64-be53f6ba39c9'::uuid, -- TypeScript
    'e163f9cf-737b-4e31-9d67-1929052386ea'::uuid, -- Python
    'f44fae71-9786-4c8c-b939-e7e842c485ae'::uuid, -- Java
    '7b96da5b-fb9b-44d0-8ff5-d8c1ce6960cc'::uuid, -- C#
    'c5bc0941-87b4-4d3f-9e34-9ce534d66959'::uuid, -- React
    '54acded2-c0c6-4fd2-8636-3bb55f60a0a0'::uuid, -- Next.js
    '978a569a-72cf-4405-96ed-b7d486629371'::uuid, -- HTML5 / Modern CSS
    '8ad4cd04-a593-4749-9af7-e25500a3e67c'::uuid, -- Vite
    '8d6cc6cb-82bb-4501-9344-fb4aafcc82a2'::uuid, -- Tailwind CSS
    '42257760-a617-4e19-b678-b01132fec330'::uuid, -- NestJS
    '27fb887f-5cd0-40e0-b1eb-c35f2547a48a'::uuid, -- Node.js & Express
    'a832eb32-fc06-40e4-ac30-bad0804f48c4'::uuid, -- Python & Flask
    '48b9f578-c8ca-476b-b4cd-a651f2cb3e90'::uuid, -- REST APIs
    'c2c4430b-5dd5-49ac-a888-cc3bb72cdc6b'::uuid, -- WebSockets
    'e6f4517d-4333-4b95-839f-859ec4f642db'::uuid, -- PostgreSQL
    '28bf57ae-ef6c-492c-a3d0-be00d56e8b37'::uuid, -- Prisma ORM
    'c5ede2f3-8c40-4cfa-a065-29296f824e42'::uuid, -- MongoDB
    '85873b96-82a0-4a2f-9be1-9c9d25421dde'::uuid, -- Flask-SQLAlchemy
    'df723876-6ba6-4aaf-a412-e59e0a305b65'::uuid, -- Docker & Containers
    'a70d2847-0efc-470f-9087-2f8036ae39e0'::uuid, -- Git & GitHub Actions
    '0ca7a68b-ee38-447a-a165-7eb241231d9b'::uuid  -- Linux & Bash
);

DELETE FROM public.skills
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(name)) 
            ORDER BY created_at ASC, id ASC
        ) as rn
        FROM public.skills
    ) t WHERE t.rn > 1
);

-- ----------------------------------------------------------------------------
-- 3. REMOVE DUPLICATE EXPERIENCE (Keep original 1, remove 1 duplicate ID)
-- ----------------------------------------------------------------------------
DELETE FROM public.experience
WHERE id IN (
    '3ebf7b46-388c-43aa-95a7-84f566a87686'::uuid -- Front-End Web Development Intern
);

DELETE FROM public.experience
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(role)), LOWER(TRIM(company)) 
            ORDER BY created_at ASC, id ASC
        ) as rn
        FROM public.experience
    ) t WHERE t.rn > 1
);

-- ----------------------------------------------------------------------------
-- 4. REMOVE DUPLICATE EDUCATION (Keep original 3, remove 3 duplicate IDs)
-- ----------------------------------------------------------------------------
DELETE FROM public.education
WHERE id IN (
    '9c4ecea3-08da-46b6-b844-4c9907669a7b'::uuid, -- B.Tech in CSE
    'cb14fbea-e727-4846-897f-2d74ede6d2c5'::uuid, -- Higher Secondary
    '539f8ed5-6a79-4489-952f-9394aead6cd7'::uuid  -- SSLC
);

DELETE FROM public.education
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(degree)), LOWER(TRIM(institution)) 
            ORDER BY created_at ASC, id ASC
        ) as rn
        FROM public.education
    ) t WHERE t.rn > 1
);

-- ----------------------------------------------------------------------------
-- 5. REMOVE DUPLICATE CERTIFICATIONS (Keep original 3, remove 3 duplicate IDs)
-- ----------------------------------------------------------------------------
DELETE FROM public.certifications
WHERE id IN (
    '4f59691e-aee9-4c0d-a893-42db05a2404e'::uuid, -- Digital 101 – 30 Hours
    '34be3264-cd1f-4727-b3fe-029f214494b1'::uuid, -- Certificate Course in Cyber Awareness
    '818355b2-a08b-4c08-8127-7cbd2ed1c0cd'::uuid  -- Foundations of AI
);

DELETE FROM public.certifications
WHERE id IN (
    SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(title)), LOWER(TRIM(issuer)) 
            ORDER BY created_at ASC, id ASC
        ) as rn
        FROM public.certifications
    ) t WHERE t.rn > 1
);

-- ----------------------------------------------------------------------------
-- 6. PERMANENT INTEGRITY CONSTRAINTS (Unique indexes to prevent future duplicates)
-- ----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_title_unique ON public.projects (LOWER(TRIM(title)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_skills_name_unique ON public.skills (LOWER(TRIM(name)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_experience_role_company_unique ON public.experience (LOWER(TRIM(role)), LOWER(TRIM(company)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_education_degree_inst_unique ON public.education (LOWER(TRIM(degree)), LOWER(TRIM(institution)));
CREATE UNIQUE INDEX IF NOT EXISTS idx_certifications_title_unique ON public.certifications (LOWER(TRIM(title)));

COMMIT;

-- Verification query
SELECT 
    (SELECT count(*) FROM public.projects) AS projects_count,
    (SELECT count(*) FROM public.skills) AS skills_count,
    (SELECT count(*) FROM public.experience) AS experience_count,
    (SELECT count(*) FROM public.education) AS education_count,
    (SELECT count(*) FROM public.certifications) AS certifications_count,
    (SELECT count(*) FROM public.public_profiles) AS profile_count;
