<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Memories master list email (management report)
    |--------------------------------------------------------------------------
    |
    | Default recipient for the memories:master-list Artisan command when
    | --email is omitted. Override with MEMORIES_MASTER_LIST_EMAIL in .env.
    |
    */

    'master_list_email' => env('MEMORIES_MASTER_LIST_EMAIL', 'chasejr@byu.edu'),

];
