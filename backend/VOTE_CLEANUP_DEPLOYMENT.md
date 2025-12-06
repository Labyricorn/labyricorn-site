# Vote Cleanup Deployment Guide

## Overview

The Kanban board system includes a vote tracking mechanism that stores vote records with IP hashes to prevent duplicate voting. To maintain database performance and allow users to vote again after a reasonable period, vote records older than 90 days should be periodically cleaned up.

## Management Command

The `cleanup_old_votes` management command removes CardVote records older than 90 days.

### Manual Execution

To run the cleanup manually:

```bash
cd /path/to/project/backend
python manage.py cleanup_old_votes
```

### Expected Output

```
Starting vote cleanup...
Successfully deleted 42 old vote record(s)
```

Or if no old records exist:

```
Starting vote cleanup...
No old vote records found to delete
```

## Automated Scheduling

### Using Cron (Linux/Unix)

1. Open the crontab editor:
   ```bash
   crontab -e
   ```

2. Add the following line to run the cleanup daily at 2:00 AM:
   ```bash
   0 2 * * * cd /path/to/project/backend && /path/to/python manage.py cleanup_old_votes >> /path/to/logs/vote_cleanup.log 2>&1
   ```

3. Replace the paths:
   - `/path/to/project/backend` - Your project's backend directory
   - `/path/to/python` - Path to your Python interpreter (use `which python` to find it)
   - `/path/to/logs/vote_cleanup.log` - Log file location

4. Save and exit the editor

### Using Windows Task Scheduler

1. Open Task Scheduler
2. Create a new Basic Task
3. Set the trigger to Daily at 2:00 AM
4. Set the action to "Start a program"
5. Program/script: `C:\path\to\python.exe`
6. Add arguments: `manage.py cleanup_old_votes`
7. Start in: `C:\path\to\project\backend`

### Using Celery Beat (Recommended for Production)

If your project uses Celery for task scheduling:

1. Add to your `celery.py`:
   ```python
   from celery.schedules import crontab
   
   app.conf.beat_schedule = {
       'cleanup-old-votes': {
           'task': 'api.tasks.cleanup_old_votes',
           'schedule': crontab(hour=2, minute=0),  # Daily at 2 AM
       },
   }
   ```

2. Create the task in `api/tasks.py`:
   ```python
   from celery import shared_task
   from api.models import CardVote
   
   @shared_task
   def cleanup_old_votes():
       deleted_count = CardVote.cleanup_old_votes()
       return f'Deleted {deleted_count} old vote records'
   ```

3. Start Celery Beat:
   ```bash
   celery -A labyricorn beat --loglevel=info
   ```

## Monitoring

### Log Rotation

If using cron with log files, set up log rotation to prevent disk space issues:

1. Create `/etc/logrotate.d/vote_cleanup`:
   ```
   /path/to/logs/vote_cleanup.log {
       daily
       rotate 7
       compress
       delaycompress
       missingok
       notifempty
   }
   ```

### Monitoring Alerts

Consider setting up alerts for:
- Command failures (exit code != 0)
- Unusually high deletion counts (may indicate a bug)
- Command not running for more than 24 hours

## Testing

Before deploying to production, test the command:

1. Create some test vote records with old dates:
   ```python
   from django.utils import timezone
   from datetime import timedelta
   from api.models import CardVote, KanbanCard
   
   # Create a test vote 91 days old
   old_date = timezone.now() - timedelta(days=91)
   card = KanbanCard.objects.first()
   vote = CardVote.objects.create(
       card=card,
       ip_hash='test_hash_123'
   )
   vote.voted_at = old_date
   vote.save()
   ```

2. Run the cleanup command:
   ```bash
   python manage.py cleanup_old_votes
   ```

3. Verify the old vote was deleted:
   ```python
   CardVote.objects.filter(ip_hash='test_hash_123').exists()  # Should be False
   ```

## Troubleshooting

### Command Not Found

If you get "Unknown command: cleanup_old_votes":
- Ensure the `api/management/commands/` directory structure exists
- Verify `__init__.py` files are present in both `management/` and `commands/`
- Restart your Django application

### Permission Errors

If you get permission errors:
- Ensure the cron user has read/write access to the database
- Verify the log file directory is writable
- Check that the Python virtual environment is accessible

### Database Lock Errors

If you encounter database locks:
- Ensure the cleanup runs during low-traffic periods (e.g., 2 AM)
- Consider adding a timeout to the database query
- Check for long-running transactions that might block the cleanup

## Performance Considerations

- The cleanup operation uses a simple DELETE query with a date filter
- Database indexes on `voted_at` field ensure efficient cleanup
- Expected execution time: < 1 second for most databases
- For very large databases (millions of votes), consider batching:
  ```python
  # In CardVote.cleanup_old_votes()
  batch_size = 10000
  while True:
      deleted = cls.objects.filter(
          voted_at__lt=cutoff_date
      )[:batch_size].delete()[0]
      if deleted == 0:
          break
      total_deleted += deleted
  ```

## Security Notes

- The cleanup command only removes vote records, not the vote counts on cards
- IP hashes are permanently deleted, allowing users to vote again after 90 days
- No sensitive data is logged by the command
- Ensure log files have appropriate permissions (600 or 640)

## Rollback

If you need to disable the cleanup:
1. Remove the cron job: `crontab -e` and delete the line
2. Or disable Celery Beat task by commenting out the schedule
3. The command can be safely re-enabled at any time

## Support

For issues or questions:
- Check Django logs for detailed error messages
- Review the CardVote model's cleanup_old_votes() method
- Verify database connectivity and permissions
