<?php

namespace App\Http\Controllers\Api;

use App\Models\Location;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class LocationController extends BaseController
{
    /**
     * List locations for dropdowns (ordered by name).
     */
    public function index()
    {
        $locations = Location::orderBy('name')->get();

        return $this->sendResponse($locations, 'Locations');
    }

    /**
     * Create a location (e.g. before assigning a new memory to it).
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'state' => 'required|string|max:255',
            'street' => 'nullable|string|max:255',
            'city' => 'nullable|string|max:255',
            'zipcode' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return $this->sendError('Validation Error.', $validator->errors(), 422);
        }

        $location = Location::create($validator->validated());

        return $this->sendResponse($location, 'Location created successfully');
    }
}
