import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore } from 'date-fns';
import User from '../models/User';
import File from '../models/File';
import Appointment from '../models/Appointment';

class AppointmentController {
    async index(req, res) {
        const { page } = req.query;

        const appointments = await Appointment.findAll({
            where: {
                user_id: req.userId,
                canceled_at: null,
            },
            order: ['date'],
            attributes: ['id', 'date'],
            limit: 20,
            offset: (page - 1) * 20,
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['id', 'name'],
                    include: [
                        {
                            model: File,
                            as: 'avatar',
                            attributes: ['id', 'url', 'path'],
                        },
                    ],
                },
            ],
        });

        return res.json(appointments);
    }

    async store(req, res) {
        const schema = Yup.object().shape({
            provider_id: Yup.number().required(),
            date: Yup.date().required(),
        });

        if (!(await schema.isValid(req.body))) {
            return res.status(400).json({ error: 'Validation fails.' });
        }

        const { provider_id, date } = req.body;

        // First we need to certificate that the provider_id is a provider
        const isProvider = await User.findOne({
            where: {
                id: provider_id,
                provider: true,
            },
        });

        if (!isProvider) {
            return res.status(401).json({
                error: 'You can only create appointment with providers',
            });
        }

        const hourStart = startOfHour(parseISO(date));

        // Check for past dates
        if (isBefore(hourStart, new Date())) {
            return res
                .status(400)
                .json({ error: 'Past date are not permitted!' });
        }

        // Check date availability
        const checkAvailability = await Appointment.findOne({
            where: {
                provider_id,
                canceled_at: null,
                date: hourStart,
            },
        });

        if (checkAvailability) {
            return res
                .status(400)
                .json({ error: 'Appointment date is not available.' });
        }

        const appointment = await Appointment.create({
            user_id: req.userId,
            provider_id,
            date,
        });

        return res.json(appointment);
    }
}

export default new AppointmentController();
