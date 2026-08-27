// Reads Windows toast notifications (via the UserNotificationListener API)
// and forwards any that look like they're from WhatsApp to the local
// trip-monitor server's /api/ingest endpoint.
//
// This never touches WhatsApp's protocol at all — it only reads what
// Windows itself displays, the same way your eyes would. Requires the
// user to grant "Notification access" once (the app will prompt).

using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;
using Windows.UI.Notifications;
using Windows.UI.Notifications.Management;

class Listener
{
    // Change this if you run the server on a different port.
    static readonly string IngestUrl = "http://localhost:4173/api/ingest";
    static readonly HttpClient http = new HttpClient();

    static async Task Main()
    {
        Console.WriteLine("Requesting notification access from Windows...");
        var listener = UserNotificationListener.Current;
        var status = await listener.RequestAccessAsync();

        if (status != UserNotificationListenerAccessStatus.Allowed)
        {
            Console.WriteLine("Notification access was not granted.");
            Console.WriteLine("Go to Windows Settings > Privacy & security > Notifications,");
            Console.WriteLine("find this app, and turn access on. Then restart this program.");
            return;
        }

        Console.WriteLine("Access granted. Listening for WhatsApp notifications...");
        Console.WriteLine($"Forwarding matches to {IngestUrl}");
        Console.WriteLine("Leave this window open. Press Ctrl+C to stop.\n");

        while (true)
        {
            try
            {
                var notifications = await listener.GetNotificationsAsync(NotificationKinds.Toast);
                foreach (var notif in notifications)
                {
                    ProcessNotification(notif);
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[warn] error reading notifications: {ex.Message}");
            }

            await Task.Delay(2000); // poll every 2s
        }
    }

    static readonly System.Collections.Generic.HashSet<uint> seenIds = new();

    static void ProcessNotification(UserNotification notif)
    {
        if (seenIds.Contains(notif.Id)) return;
        seenIds.Add(notif.Id);
        // keep the seen-set from growing forever
        if (seenIds.Count > 5000) seenIds.Clear();

        string appName = notif.AppInfo?.DisplayInfo?.DisplayName ?? "";
        if (!appName.ToLower().Contains("whatsapp")) return;

        var binding = notif.Notification.Visual?.GetBinding(KnownNotificationBindings.ToastGeneric);
        if (binding == null) return;

        var texts = binding.GetTextElements();
        // Typically: [0] = group/sender name, [1]+ = message body lines
        string groupName = texts.Count > 0 ? texts[0].Text : "";
        string body = string.Join("\n", System.Linq.Enumerable.Skip(texts, 1).Select(t => t.Text));

        if (string.IsNullOrWhiteSpace(body)) return;

        Console.WriteLine($"[notification] {groupName}: {body.Substring(0, Math.Min(60, body.Length))}...");
        _ = SendToServer(groupName, body);
    }

    static async Task SendToServer(string groupName, string text)
    {
        try
        {
            var payload = JsonSerializer.Serialize(new
            {
                text,
                source = "windows_notification",
                groupName
            });
            var content = new StringContent(payload, Encoding.UTF8, "application/json");
            var resp = await http.PostAsync(IngestUrl, content);
            if (!resp.IsSuccessStatusCode)
            {
                Console.WriteLine($"[warn] server responded {resp.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[warn] could not reach server: {ex.Message}");
            Console.WriteLine("Is `npm start` running in the main project folder?");
        }
    }
}
