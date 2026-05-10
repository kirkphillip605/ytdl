/*
  # Create downloads table for YouTube metadata tracking

  1. New Tables
    - `downloads`
      - `id` (uuid, primary key)
      - `youtube_url` (text, required)
      - `artist` (text, required)
      - `title` (text, required)
      - `file_path` (text, required)
      - `thumbnail_url` (text)
      - `created_at` (timestamptz, default now())
  2. Security
    - Enable RLS on `downloads` table
    - Add policy for public access (simplified for this demo, in production use auth.uid())
*/

CREATE TABLE IF NOT EXISTS downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  youtube_url text NOT NULL,
  artist text NOT NULL,
  title text NOT NULL,
  file_path text NOT NULL,
  thumbnail_url text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE downloads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access"
  ON downloads FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Allow public insert access"
  ON downloads FOR INSERT
  TO public
  WITH CHECK (true);

CREATE POLICY "Allow public update access"
  ON downloads FOR UPDATE
  TO public
  USING (true);