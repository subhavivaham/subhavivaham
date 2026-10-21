-- Subha Vivaham - MySQL teardown (drops everything table_creation_mysql.sql creates)
-- Run only to reset a database. Order matters: child tables before parents.
-- There is no RLS/policy layer in MySQL, so nothing here mirrors the old
-- Postgres storage policies - authorization lives in the application.

-- ---------------------------------------------------------------------------
-- triggers first (they reference the tables below)
-- ---------------------------------------------------------------------------
drop trigger if exists temple_images_cap;
drop trigger if exists trg_touch_users;
drop trigger if exists trg_touch_communities;
drop trigger if exists trg_touch_profiles;
drop trigger if exists trg_touch_interests;
drop trigger if exists trg_touch_subscriptions;
drop trigger if exists trg_touch_payments;
drop trigger if exists trg_touch_stories;
drop trigger if exists trg_touch_temples;
drop trigger if exists trg_touch_temple_services;
drop trigger if exists trg_touch_temple_festivals;
drop trigger if exists trg_touch_service_providers;

-- ---------------------------------------------------------------------------
-- child tables first, then parents
-- ---------------------------------------------------------------------------
drop table if exists profile_photos;
drop table if exists interests;
drop table if exists temple_images;
drop table if exists temple_festivals;
drop table if exists temple_services;
drop table if exists membership_payments;
drop table if exists subscriptions;
drop table if exists sessions;
drop table if exists profiles;
drop table if exists service_providers;
drop table if exists temples;
drop table if exists membership_plans;
drop table if exists success_stories;
drop table if exists communities;
drop table if exists site_config;
drop table if exists users;

-- ---------------------------------------------------------------------------
-- database itself (optional - uncomment to remove the schema entirely)
-- ---------------------------------------------------------------------------
-- drop database if exists subhavivaham;
