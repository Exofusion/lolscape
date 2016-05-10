# LoLScape

## Description
League of Legends is at its core a skill based game, the primary way to measure skill is by ELO and ranked progression.  But that isn't the only way to play, some people have no interest in the ranked ladder at all.  With the introduction of Champion Mastery points, the first thing I thought of were the days of old school RuneScape, playing for hours to climb the highscores with XP gains.  Currently there isn't a great way to view those summoners who have put in the grind to top the charts.  LoLScape exists to fill this void, and gives a platform for those long hours of play to be recognized.

## Site Sections
### Overall Hiscores
The overall hiscores are the core of LoLScape.  The overall hiscores are split into one leaderboard by total champion mastery level and one by total champion mastery experience.  The overall champion level leaderboard recognizes the true jack-of-all-trades summoners.  The overall experience leaderboard simply totals the mastery experience across all champions, so you could only played a single champion and top these charts.
### Champion Hiscores
As you can probably guess, the champion hiscore page shows summoners who have dedicated themselves to a specific champion.  Make a note to inspect the profile icons and summoner names here carefully, often these summoners truly embody the spirit of their champion.
### Summoner Comparison
Here you can get a detailed champion-by-champion breakdown between two summoners.  There is a lot of data on this page, so you can sort by each column depending on what you're interested in.
### Personal Lookup
This page lets you view global champion rankings and experience for a specific summoner.  Each column on this page can also be clicked to sort the table.

## Tech Stack
- **Web Server**: Node ExpressJS
  - I chose ExpressJS for its low overhead, and quick setup.  Since I knew I wouldn't need the extra features of more robust web server, this suited my needs perfectly.
- **Database**: PostgreSQL 9.5
  - I went with PostgreSQL because of its ease of setup on Linux.  After an "apt-get" and one-line config-file modification, it's ready to go!
- **Cloud Hosting**: DigitalOcean Ubuntu 14.04 Droplet
  - I've heard good things about this service, and it did not disappoint for the price.  I initially set the project up in Amazon's AWS ecosystem, but the monthly cost to get instance SSD drives wasn't feasible.  In the event that serious scaling is needed, I'd probably go back to AWS however.
  
## Design Philosophy
This project was set up to be as self-sufficient as possible, with little maintenance required.  Anytime a user is looked up through the API, the resulting data is validated, and the database is updated along with the current timestamp.  Using this timestamp, the project maintainer can decide how often the same summoner should be allowed to fetch new data.  As it stands, each page load tries to get the freshest data, but this can be easily changed.  The only scheduled tasks that need to be run is clustering the tables, which can be automated.

## Installation Instructions
### Requirements
- NodeJS (https://nodejs.org)
- PostgreSQL 9.5+ (http://www.postgresql.org)
- Riot API Key (https://developer.riotgames.com)

### API Key
Find the file marked 'api_key.json.EDITME', insert your personal Riot API key here, and rename the file to 'api_key.json'.

### Database Initialization
To work out of the box, a new user needs to be added to PostgreSQL, username of "pg_user" and password "root" with access to a fresh database named "rac2016".

#### summoner_data
```
CREATE TABLE public.summoner_data
(
  id integer NOT NULL,
  summoner_level smallint,
  profile_icon_id smallint,
  last_updated timestamp without time zone,
  revision_date bigint,
  name character varying(32),
  name_cleaned character varying(32),
  region_id smallint NOT NULL,
  CONSTRAINT summoner_data_pkey PRIMARY KEY (id, region_id)
);
```
No serious indexing needed here for now, but with multi-region support a new indexes may need to be implemented as needed.

#### summoner_champ_mastery
```
CREATE TABLE public.summoner_champ_mastery
(
  summoner_id integer NOT NULL,
  region_id smallint NOT NULL,
  champion_points integer,
  champion_points_until_next_level integer,
  champion_points_since_last_level integer,
  champion_id smallint NOT NULL,
  champion_level smallint,
  chest_granted boolean,
  last_play_time bigint,
  highest_grade character varying,
  last_updated timestamp with time zone,
  CONSTRAINT summoner_champ_mastery_pkey PRIMARY KEY (summoner_id, region_id, champion_id)
);
```
Here's where most of the data lies, all response data returned from the API during a summoner lookup is recorded here so we have a cached record.  The glue that holds this together is the following index:
```
CREATE UNIQUE INDEX champion_rank
  ON public.summoner_champ_mastery
  USING btree
  (champion_id, champion_points DESC NULLS LAST, region_id, summoner_id);
ALTER TABLE public.summoner_champ_mastery CLUSTER ON champion_rank;
```
The ordering of this index is extremely important for performance.  By ordering the descending champion point entries, partitioned by each champion_id, we get fast queries for the leaderboard lookups.  By saving our total values for each summoner's champion as champion 0, we also get extremely fast overall score lookup without needing to sum each entry on the fly.

### Node Initialization
Luckily this is where Node really shines.
- Open a command prompt in the root project folder
- Run "npm install"
- Run "npm start"

The local webserver should now be listening on http://localhost:3000