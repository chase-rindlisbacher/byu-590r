<?php

namespace App\Http\Controllers\Api;

use App\Mail\VerifyEmail;
use App\Models\User;
use App\Models\UserPreference;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;

class UserController extends BaseController
{
    public function getUser()
    {
        $authUser = Auth::user();
        $user = User::with('userPreference')->findOrFail($authUser->id);
        // null = stable public URL (not 10m presigned) so SPA localStorage avatar survives sessions
        $user->avatar = $this->getS3Url($user->avatar, null);

        $pref = $user->userPreference
            ?? UserPreference::firstOrCreate(
                ['user_id' => $user->id],
                UserPreference::defaultAttributes()
            );

        $results = $user->toArray();
        unset($results['user_preference']);
        $results['preferences'] = $this->preferencePayload($pref);

        return $this->sendResponse($results, 'User');
    }

    public function updatePreferences(Request $request)
    {
        $validated = $request->validate([
            'generate_images' => 'sometimes|boolean',
            'use_extra_memory_context' => 'sometimes|boolean',
            'dismiss_memory_image_prompt' => 'sometimes|boolean',
        ]);

        $authUser = Auth::user();
        $pref = UserPreference::firstOrCreate(
            ['user_id' => $authUser->id],
            UserPreference::defaultAttributes()
        );
        $pref->fill($validated);
        $pref->save();

        return $this->sendResponse($this->preferencePayload($pref), 'User preferences updated');
    }

    /**
     * @return array{generate_images: bool, use_extra_memory_context: bool, dismiss_memory_image_prompt: bool}
     */
    private function preferencePayload(UserPreference $pref): array
    {
        return [
            'generate_images' => (bool) $pref->generate_images,
            'use_extra_memory_context' => (bool) $pref->use_extra_memory_context,
            'dismiss_memory_image_prompt' => (bool) $pref->dismiss_memory_image_prompt,
        ];
    }

    public function uploadAvatar(Request $request)
    {
        $request->validate([
            'image' => 'required|image|mimes:jpeg,png,jpg,gif,svg',
        ]);
        if ($request->hasFile('image')) {
            $authUser = Auth::user();
            $user = User::findOrFail($authUser->id);
            $extension = request()->file('image')->getClientOriginalExtension();
            $image_name = time() . '_' . $authUser->id . '.' . $extension;
            $path = $request->file('image')->storeAs(
                'images',
                $image_name,
                's3'
            );
            Storage::disk('s3')->setVisibility($path, "public");
            if (!$path) {
                return $this->sendError($path, 'User profile avatar failed to upload!');
            }

            $user->avatar = $path;
            $user->save();
            $success['avatar'] = null;
            if (isset($user->avatar)) {
                $success['avatar'] = $this->getS3Url($path, null);
            }
            return $this->sendResponse($success, 'User profile avatar uploaded successfully!');
        }
    }

    public function removeAvatar()
    {
        $authUser = Auth::user();
        $user = User::findOrFail($authUser->id);
        Storage::disk('s3')->delete($user->avatar);
        $user->avatar = null;
        $user->save();
        $success['avatar'] = null;
        return $this->sendResponse($success, 'User profile avatar removed successfully!');
    }

    public function sendVerificationEmail(Request $request)
    {
        $authUser = Auth::user();
        $user = User::findOrFail($authUser->id);
        Mail::to($user->email)->send(new VerifyEmail($user->email));
        $success['status'] = true;
        return $this->sendResponse($success, 'Email sent to ' . $user->email);
    }

    public function changeEmail(Request $request)
    {
        $request->validate([
            'change_email' => 'required|email|unique:users,email|min:3',
        ]);
        $authUser = Auth::user();
        $user = User::findOrFail($authUser->id);
        $user->email = $request->change_email;
        $user->save();
        Mail::to($user->email)->send(new VerifyEmail($user->email));
        $success['email'] = $user->email;
        return $this->sendResponse($success, 'Email sent to ' . $user->email);
    }
}

