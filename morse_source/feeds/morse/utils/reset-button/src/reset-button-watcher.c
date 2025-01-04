/*
 *  copyright (C) 2021-2022 Morse Micro Pty Ltd. All rights reserved.
 */

#include <stdio.h>
#include <pthread.h>
#include <sched.h>
#include <stdlib.h>
#include <fcntl.h>
#include <unistd.h>
#include <poll.h>
#include <time.h>
#include <string.h>
#include <errno.h>
#include <sys/stat.h>

// high priority or an error occured in SW
#define POLL_GPIO POLLPRI | POLLERR

#ifndef RESET_BT
#define RESET_BT "453"
#endif

#define EXPORT_PATH "/sys/class/gpio/export"
#define RB_BASE_PATH "/sys/class/gpio/gpio" RESET_BT
#define RB_VAL_PATH  "/sys/class/gpio/gpio" RESET_BT "/value"
#define RB_INT_PATH  "/sys/class/gpio/gpio" RESET_BT "/edge"
#define RB_DIR_PATH  "/sys/class/gpio/gpio" RESET_BT "/direction"

const char *sw = RESET_BT; // Linux GPIO representation

void close_fd(int);
int configure_pins();
void set_realtime_prio();

int main(int argc, char *argv[])
{
    int fd, poll_ret;
    double period;
    char value;
    struct pollfd poll_gpio;
    struct timespec t_push = {0, 0}, t_release = {0, 0};

    set_realtime_prio();
    configure_pins();

    while ((fd = open(RB_VAL_PATH, O_RDONLY)) <= 0)
        ;

    // file descriptor from SW is being polled
    poll_gpio.fd = fd;
    // poll events in GPIO
    poll_gpio.events = POLL_GPIO;
    poll_gpio.revents = 0;

    read(fd, &value, 1);

    while (1)
    {
        
        lseek(fd, 0, SEEK_SET);
        read(fd, &value, 1); // read GPIO value
        poll_ret = poll(&poll_gpio, 1, -1);

        if (!poll_ret)
        {
            continue;
        }
        else
        {

            if (poll_ret == -1)
            {
                perror("poll");
                return EXIT_FAILURE;
            }

            if ((poll_gpio.revents) & (POLL_GPIO))
            {
                lseek(fd, 0, SEEK_SET);
                read(fd, &value, 1); // read GPIO value
                if (value == '1')
                {
                    clock_gettime(CLOCK_MONOTONIC, &t_release);
                    printf("the reset button is released! %c\n", value);
                }
                else if (value == '0')
                {
                    clock_gettime(CLOCK_MONOTONIC, &t_push);
                    printf("the reset button is pushed! %c\n", value);
                }
            }
        }
        
        

        if(value == '1' && t_push.tv_sec && t_push.tv_nsec)
        {
            period = (((double)t_release.tv_sec + 1.0e-9 * t_release.tv_nsec) - ((double)t_push.tv_sec + 1.0e-9 * t_push.tv_nsec)); // period in ms
            printf("button was hold for %f seconds\n", period);
            if (period > 5)
            {
                system("/sbin/reset-button factory &");
            }
            else
            {
                system("/sbin/reset-button reboot &");
            }
        }
    }

    close(fd); // close value file

    return EXIT_SUCCESS;
}

void set_realtime_prio()
{
    pthread_t this_thread = pthread_self(); // operates in the current running thread
    struct sched_param params;
    int ret;

    // set max prio
    params.sched_priority = sched_get_priority_max(SCHED_FIFO);
    ret = pthread_setschedparam(this_thread, SCHED_FIFO, &params);

    if (ret != 0)
    {
        perror("Unsuccessful in setting thread realtime prio\n");
    }
}

void close_fd(int fd)
{
    // close file from file descriptor
    if (close(fd) < 0)
    {
        perror("Warning: Unable to close file correctly\n");
    }
}

int is_dir_exist(const char* path)
{
    struct stat sb;
    if (stat(path, &sb) == 0 && S_ISDIR(sb.st_mode)) {
        return 1;
    } else {
        return 0;
    }
}

int configure_pins()
{
    int fd_export, fd_edge, fd_input;

    /*******************EXPORT*******************/
    if (!is_dir_exist(RB_BASE_PATH))
    {
        // open export file
        if ((fd_export = open(EXPORT_PATH, O_WRONLY)) <= 0)
        {
            perror("Unable to open export file\n");
            return EXIT_FAILURE;
        }
        // export SW GPIO
        if (write(fd_export, sw, strlen(sw)) < 0)
        {
            if (errno != EBUSY)
            { // does not end if pin is already exported
                perror("Unable to export SW GPIO\n");
                close_fd(fd_export);
                return EXIT_FAILURE;
            }
            perror("Warning: Unable to export SW GPIO\n");
        }

        // close export file
        close_fd(fd_export);
    }
    /******************DIRECTION******************/
    // open direction file
    if ((fd_input = open(RB_DIR_PATH, O_WRONLY)) <= 0)
    {
        perror("Unable to open direction file for PIN 15\n");
        return EXIT_FAILURE;
    }
    if (write(fd_input, "in", 2) < 0)
    { // configure as input
        if (errno != EBUSY)
        {
            perror("Unable to change direction from SW\n");
            close_fd(fd_input);
            return EXIT_FAILURE;
        }
        perror("Warning: unable to change direction from SW\n");
    }

    close_fd(fd_input); // close direction file

    /********************EDGE*********************/
    while ((fd_edge = open(RB_INT_PATH, O_RDWR)) <= 0);
    while (write(fd_edge, "both", 6) < 0);
    close_fd(fd_edge);

    return EXIT_SUCCESS;
}