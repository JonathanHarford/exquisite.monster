-- Add temporary columns for the conversion
ALTER TABLE "game_configs" 
ADD COLUMN "writingTimeout_temp" TEXT;
ALTER TABLE "game_configs"
ADD COLUMN "drawingTimeout_temp" TEXT;
ALTER TABLE "game_configs"
ADD COLUMN "gameTimeout_temp" TEXT;

-- Convert existing millisecond values to duration strings
-- Helper function to convert milliseconds to duration string
CREATE OR REPLACE FUNCTION ms_to_duration(ms INTEGER) RETURNS TEXT AS $$
DECLARE
    days INTEGER;
    hours INTEGER;
    minutes INTEGER;
    seconds INTEGER;
    result TEXT := '';
BEGIN
    IF ms IS NULL OR ms = 0 THEN
        RETURN '0s';
    END IF;
    
    days := ms / (24 * 60 * 60 * 1000);
    ms := ms % (24 * 60 * 60 * 1000);
    
    hours := ms / (60 * 60 * 1000);
    ms := ms % (60 * 60 * 1000);
    
    minutes := ms / (60 * 1000);
    ms := ms % (60 * 1000);
    
    seconds := ms / 1000;
    
    IF days > 0 THEN
        result := result || days || 'd';
    END IF;
    IF hours > 0 THEN
        result := result || hours || 'h';
    END IF;
    IF minutes > 0 THEN
        result := result || minutes || 'm';
    END IF;
    IF seconds > 0 THEN
        result := result || seconds || 's';
    END IF;
    
    IF result = '' THEN
        result := '0s';
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Update the temporary columns with converted values
UPDATE "game_configs" SET
    "writingTimeout_temp" = ms_to_duration("writingTimeout"),
    "drawingTimeout_temp" = ms_to_duration("drawingTimeout"),
    "gameTimeout_temp" = ms_to_duration("gameTimeout");

-- Drop the old columns
ALTER TABLE "game_configs" 
DROP COLUMN "writingTimeout";
ALTER TABLE "game_configs"
DROP COLUMN "drawingTimeout";
ALTER TABLE "game_configs"
DROP COLUMN "gameTimeout";

-- Rename temporary columns to original names
ALTER TABLE "game_configs" 
RENAME COLUMN "writingTimeout_temp" TO "writingTimeout";
ALTER TABLE "game_configs"
RENAME COLUMN "drawingTimeout_temp" TO "drawingTimeout";
ALTER TABLE "game_configs"
RENAME COLUMN "gameTimeout_temp" TO "gameTimeout";

-- Clean up the helper function
DROP FUNCTION ms_to_duration(INTEGER);
