<?php

preg_match('#TMDB_API_KEY=([a-z0-9]+)#', file_get_contents(__DIR__ . '/../.env'), $matches);
$apiKey = $matches ? $matches[1] : null;
if (empty($apiKey))
{
  exit(0);
}

$files = glob('./movies/*.json');
foreach($files as $file)
{
  $movies = json_decode(file_get_contents($file), true);
  foreach($movies as $id => $movie)
  {
    echo 'Fetching data (' . $file . ' - ' . ($id + 1) . ' / ' . count($movies) . ')' . "\n";
    $data = fetchMovie($movie['tmdb_id'], $apiKey);
    if (!isset($data['genres']))
    {
      var_dump($movie['title']);
      var_dump($movie['tmdb_id']);
      var_dump($data);
    }
    $genres = array_map(function($genre) {
      return $genre['name'];
    }, isset($data['genres']) ? $data['genres'] : []);
    sort($genres);
    $movies[$id]['genres'] = $genres;
    sleep(0.25);
  }
  file_put_contents($file, str_replace('    ', '  ', json_encode($movies, JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE|JSON_UNESCAPED_SLASHES)));
}

function fetchMovie($movieId, $apiKey)
{
  $curl = curl_init();
  curl_setopt($curl, CURLOPT_URL, 'https://api.themoviedb.org/3/movie/' . $movieId . '?api_key=' . $apiKey);
  curl_setopt($curl, CURLOPT_RETURNTRANSFER, true);
  $json = json_decode(curl_exec($curl), true);
  curl_close($curl);
  return $json;
}
